import AVFoundation
import ExpoModulesCore
import UIKit

public class FormVideoNormalizerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FormVideoNormalizer")

    AsyncFunction("normalizeVideoAsync") { (localUri: URL, promise: Promise) in
      self.exportVideo(localUri: localUri, privacySafeUpperBody: false, promise: promise)
    }

    AsyncFunction("normalizePrivacySafeUpperBodyAsync") { (localUri: URL, promise: Promise) in
      self.exportVideo(localUri: localUri, privacySafeUpperBody: true, promise: promise)
    }
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
      for sourceAudio in asset.tracks(withMediaType: .audio) {
        if let destinationAudio = composition.addMutableTrack(
          withMediaType: .audio,
          preferredTrackID: kCMPersistentTrackID_Invalid
        ) {
          try destinationAudio.insertTimeRange(fullRange, of: sourceAudio, at: .zero)
        }
      }
    } catch {
      promise.reject(
        "VIDEO_EXPORT_SETUP_FAILED",
        "The full recording could not be copied: \(error.localizedDescription)"
      )
      return
    }

    let sourceRect = CGRect(origin: .zero, size: sourceVideo.naturalSize)
    let transformedRect = sourceRect.applying(sourceVideo.preferredTransform)
    let renderSize = CGSize(width: abs(transformedRect.width), height: abs(transformedRect.height))
    let uprightTransform = sourceVideo.preferredTransform.concatenating(
      CGAffineTransform(translationX: -transformedRect.origin.x, y: -transformedRect.origin.y)
    )

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
    let preset = privacySafeUpperBody ? AVAssetExportPresetMediumQuality : AVAssetExportPresetHighestQuality
    guard let exporter = AVAssetExportSession(asset: composition, presetName: preset) else {
      promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The analysis video exporter is unavailable.")
      return
    }
    exporter.outputURL = outputUrl
    exporter.outputFileType = .mp4
    exporter.shouldOptimizeForNetworkUse = true
    exporter.videoComposition = videoComposition
    exporter.exportAsynchronously {
      switch exporter.status {
      case .completed:
        promise.resolve(outputUrl.absoluteString)
      case .cancelled:
        promise.reject("VIDEO_EXPORT_CANCELLED", "The analysis video export was cancelled.")
      default:
        promise.reject(
          "VIDEO_EXPORT_FAILED",
          exporter.error?.localizedDescription ?? "The analysis video export failed."
        )
      }
    }
  }
}
