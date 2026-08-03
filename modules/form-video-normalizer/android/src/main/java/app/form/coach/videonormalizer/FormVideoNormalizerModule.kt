package app.form.coach.videonormalizer

import android.net.Uri
import android.media.MediaMetadataRetriever
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Crop
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

class FormVideoNormalizerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FormVideoNormalizer")

    AsyncFunction("normalizeVideoAsync") { localUri: String, promise: Promise ->
      exportVideo(localUri, false, promise)
    }

    AsyncFunction("prepareVideoAsync") { localUri: String, promise: Promise ->
      prepareVideo(localUri, promise)
    }

    AsyncFunction("normalizePrivacySafeUpperBodyAsync") { localUri: String, promise: Promise ->
      exportVideo(localUri, true, promise)
    }
  }

  private fun prepareVideo(localUri: String, promise: Promise) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The application context is unavailable.", null)
      return
    }
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(context, Uri.parse(localUri))
      val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      if (durationMs <= 0L || width <= 0 || height <= 0) {
        promise.reject("VIDEO_TRACK_MISSING", "The recording does not contain a readable video track.", null)
      } else if (Math.floorMod(rotation, 360) == 0) {
        promise.resolve(localUri)
      } else {
        exportVideo(localUri, false, promise)
      }
    } catch (error: Exception) {
      promise.reject("VIDEO_METADATA_FAILED", error.message, error)
    } finally {
      retriever.release()
    }
  }

  private fun exportVideo(localUri: String, privacySafeUpperBody: Boolean, promise: Promise) {
    val context = appContext.reactContext
    if (context == null) {
      promise.reject("VIDEO_EXPORT_SETUP_FAILED", "The application context is unavailable.", null)
      return
    }
    val prefix = if (privacySafeUpperBody) "form-analysis-upper-body" else "form-analysis-upright"
    val output = File(context.cacheDir, "$prefix-${UUID.randomUUID()}.mp4")
    val videoEffects = mutableListOf<Effect>()
    if (privacySafeUpperBody) {
      // Normalized device coordinates: retain only the upper 42% of the upright frame.
      videoEffects.add(Crop(-1f, 1f, 0.16f, 1f))
    }
    val edited = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(localUri)))
      .setRemoveAudio(true)
      .setEffects(Effects(emptyList(), videoEffects))
      .build()
    val encoderFactory = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(
        VideoEncoderSettings.Builder()
          .setBitrate(2_750_000)
          .build()
      )
      .build()
    val transformer = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      .setEncoderFactory(encoderFactory)
      // Encode the displayed portrait dimensions into the pixels instead of
      // writing landscape pixels with rotation metadata.
      .setPortraitEncodingEnabled(true)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          promise.resolve(Uri.fromFile(output).toString())
        }

        override fun onError(
          composition: Composition,
          exportResult: ExportResult,
          exportException: ExportException
        ) {
          promise.reject("VIDEO_EXPORT_FAILED", exportException.message, exportException)
        }
      })
      .build()
    transformer.start(edited, output.absolutePath)
  }
}
