import AVFoundation
import ExpoModulesCore
import UIKit

public class FormVideoNormalizerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FormVideoNormalizer")

    AsyncFunction("normalizeVideoAsync") { (localUri: URL, promise: Promise) in
      self.exportVideo(localUri: localUri, privacySafeUpperBody: false, promise: promise)
    }

    AsyncFunction("prepareVideoAsync") { (localUri: URL, promise: Promise) in
      self.prepareVideo(localUri: localUri, promise: promise)
    }

    AsyncFunction("normalizePrivacySafeUpperBodyAsync") { (localUri: URL, promise: Promise) in
      self.exportVideo(localUri: localUri, privacySafeUpperBody: true, promise: promise)
    }
  }

  private func prepareVideo(localUri: URL, promise: Promise) {
    let asset = AVURLAsset(url: localUri)
    guard let sourceVideo = asset.tracks(withMediaType: .video).first else {
      promise.reject("VIDEO_TRACK_MISSING", "The recording has no video track.")
      return
    }
    guard asset.duration.isNumeric && CMTimeCompare(asset.duration, .zero) > 0 else {
      promise.reject("VIDEO_DURATION_MISSING", "The recording duration could not be read.")
      return
    }

    // Expo Camera writes a preferredTransform for portrait captures. Keep the
    // original only when it is already canonical; also normalize an upside-
    // down (180 degree) transform rather than silently passing it through.
    let transform = sourceVideo.preferredTransform
    let hasRotation = abs(transform.b) > 0.5
      || abs(transform.c) > 0.5
      || (transform.a < -0.5 && transform.d < -0.5)
    if !hasRotation {
      promise.resolve(localUri.absoluteString)
      return
    }
    self.exportVideo(localUri: localUri, privacySafeUpperBody: false, promise: promise)
  }

  private func exportVideo(localUri: URL, privacySafeUpperBody: Bool, promise: Promise) {
    let asset = AVURLAsset(url: localUri)
    guard let sourceVideo = asset.tracks(withMediaType: .video).first else {
      promise.reject("VIDEO_TRACK_MISSING", "The recording has no video track.")
      return
    }

    let composition = AVMutableComposition()
    guard let destinationVideo = composition.addMutableTrack(
      withMediaType: .video,
      preferredTrackID: kCMPersistentTrackID_Invalid
    ) else {
      promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The analysis video track could not be created.")
      return
    }

    do {
      let fullRange = CMTimeRange(start: .zero, duration: asset.duration)
      try destinationVideo.insertTimeRange(fullRange, of: sourceVideo, at: .zero)
    } catch {
      promise.reject(
        "VIDEO_EXPORT_SETUP_FAILED",
        "The full recording could not be copied: \(error.localizedDescription)"
      )
      return
    }

    let sourceRect = CGRect(origin: .zero, size: sourceVideo.naturalSize)
    let transformedRect = sourceRect.applying(sourceVideo.preferredTransform)
    let uprightSize = CGSize(width: abs(transformedRect.width), height: abs(transformedRect.height))
    let longEdgeScale = 1280 / max(uprightSize.width, uprightSize.height)
    let shortEdgeScale = 720 / min(uprightSize.width, uprightSize.height)
    let outputScale = min(1, min(longEdgeScale, shortEdgeScale))
    let renderSize = CGSize(
      width: max(2, (uprightSize.width * outputScale / 2).rounded(.down) * 2),
      height: max(2, (uprightSize.height * outputScale / 2).rounded(.down) * 2)
    )
    let uprightTransform = sourceVideo.preferredTransform.concatenating(
      CGAffineTransform(translationX: -transformedRect.origin.x, y: -transformedRect.origin.y)
    ).concatenating(CGAffineTransform(scaleX: outputScale, y: outputScale))

    let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: destinationVideo)
    layerInstruction.setTransform(uprightTransform, at: .zero)
    let instruction = AVMutableVideoCompositionInstruction()
    instruction.timeRange = CMTimeRange(start: .zero, duration: composition.duration)
    instruction.layerInstructions = [layerInstruction]
    let videoComposition = AVMutableVideoComposition()
    videoComposition.instructions = [instruction]
    videoComposition.renderSize = renderSize
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

    if privacySafeUpperBody {
      let parentLayer = CALayer()
      parentLayer.frame = CGRect(origin: .zero, size: renderSize)
      parentLayer.isGeometryFlipped = true
      let videoLayer = CALayer()
      videoLayer.frame = parentLayer.bounds
      parentLayer.addSublayer(videoLayer)

      let privacyLayer = CALayer()
      privacyLayer.frame = CGRect(
        x: 0,
        y: renderSize.height * 0.42,
        width: renderSize.width,
        height: renderSize.height * 0.58
      )
      privacyLayer.backgroundColor = UIColor.black.cgColor
      parentLayer.addSublayer(privacyLayer)
      videoComposition.animationTool = AVVideoCompositionCoreAnimationTool(
        postProcessingAsVideoLayer: videoLayer,
        in: parentLayer
      )
    }

    let prefix = privacySafeUpperBody ? "form-analysis-upper-body" : "form-analysis-upright"
    let outputUrl = FileManager.default.temporaryDirectory
      .appendingPathComponent("\(prefix)-\(UUID().uuidString)")
      .appendingPathExtension("mp4")
    do {
      let reader = try AVAssetReader(asset: composition)
      let readerOutput = AVAssetReaderVideoCompositionOutput(
        videoTracks: [destinationVideo],
        videoSettings: [
          kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
        ]
      )
      readerOutput.videoComposition = videoComposition
      readerOutput.alwaysCopiesSampleData = false
      guard reader.canAdd(readerOutput) else {
        promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The normalized video reader could not be configured.")
        return
      }
      reader.add(readerOutput)

      let writer = try AVAssetWriter(outputURL: outputUrl, fileType: .mp4)
      let writerInput = AVAssetWriterInput(
        mediaType: .video,
        outputSettings: [
          AVVideoCodecKey: AVVideoCodecType.h264,
          AVVideoWidthKey: Int(renderSize.width),
          AVVideoHeightKey: Int(renderSize.height),
          AVVideoCompressionPropertiesKey: [
            AVVideoAverageBitRateKey: 2_750_000,
            AVVideoMaxKeyFrameIntervalKey: 30,
            AVVideoAllowFrameReorderingKey: false,
          ],
        ]
      )
      writerInput.expectsMediaDataInRealTime = false
      guard writer.canAdd(writerInput) else {
        promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The H.264 video writer could not be configured.")
        return
      }
      writer.add(writerInput)
      writer.shouldOptimizeForNetworkUse = true

      guard writer.startWriting(), reader.startReading() else {
        promise.reject(
          "VIDEO_EXPORT_FAILED",
          writer.error?.localizedDescription ?? reader.error?.localizedDescription ?? "The video export could not start."
        )
        return
      }
      writer.startSession(atSourceTime: .zero)
      let exportQueue = DispatchQueue(label: "app.form.coach.video-normalizer")
      writerInput.requestMediaDataWhenReady(on: exportQueue) {
        while writerInput.isReadyForMoreMediaData {
          if let sample = readerOutput.copyNextSampleBuffer() {
            if !writerInput.append(sample) {
              reader.cancelReading()
              writerInput.markAsFinished()
              writer.cancelWriting()
              promise.reject(
                "VIDEO_EXPORT_FAILED",
                writer.error?.localizedDescription ?? "A normalized video frame could not be written."
              )
              return
            }
            continue
          }

          writerInput.markAsFinished()
          if reader.status == .failed {
            writer.cancelWriting()
            promise.reject(
              "VIDEO_EXPORT_FAILED",
              reader.error?.localizedDescription ?? "The full recording could not be decoded."
            )
            return
          }
          writer.finishWriting {
            if writer.status == .completed {
              promise.resolve(outputUrl.absoluteString)
            } else {
              promise.reject(
                "VIDEO_EXPORT_FAILED",
                writer.error?.localizedDescription ?? "The analysis video export failed."
              )
            }
          }
          return
        }
      }
    } catch {
      promise.reject("VIDEO_EXPORT_SETUP_FAILED", error.localizedDescription)
    }
  }
}
