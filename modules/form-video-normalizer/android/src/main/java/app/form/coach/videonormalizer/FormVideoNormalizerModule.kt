package app.form.coach.videonormalizer

import android.net.Uri
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.effect.Crop
import androidx.media3.effect.ScaleAndRotateTransformation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
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

    AsyncFunction("normalizePrivacySafeUpperBodyAsync") { localUri: String, promise: Promise ->
      exportVideo(localUri, true, promise)
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
    val videoEffects = mutableListOf<Effect>(
      ScaleAndRotateTransformation.Builder().setRotationDegrees(0f).build()
    )
    if (privacySafeUpperBody) {
      // Normalized device coordinates: retain only the upper 42% of the upright frame.
      videoEffects.add(Crop(-1f, 1f, 0.16f, 1f))
    }
    val edited = EditedMediaItem.Builder(MediaItem.fromUri(Uri.parse(localUri)))
      .setEffects(Effects(emptyList(), videoEffects))
      .build()
    val transformer = Transformer.Builder(context)
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
