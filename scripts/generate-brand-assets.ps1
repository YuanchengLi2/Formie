param(
  [string]$SourcePath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$images = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\assets\images'))
$sourceAsset = Join-Path $images 'form-logo-source.png'

if ($SourcePath) {
  $resolvedSource = (Resolve-Path -LiteralPath $SourcePath).Path
  [IO.File]::Copy($resolvedSource, $sourceAsset, $true)
}

if (-not (Test-Path -LiteralPath $sourceAsset)) {
  throw 'Provide -SourcePath once so the supplied FORM logo can be versioned as assets/images/form-logo-source.png.'
}

$source = New-Object System.Drawing.Bitmap($sourceAsset)
$purple = [System.Drawing.ColorTranslator]::FromHtml('#3512ED')

function New-Canvas([int]$Size, [bool]$Transparent) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { $purple }))
  return @($bitmap, $graphics)
}

function Save-SourceVariant([string]$Name, [int]$Size, [double]$Scale, [bool]$Transparent) {
  $canvas = New-Canvas $Size $Transparent
  $bitmap = $canvas[0]
  $graphics = $canvas[1]
  $destinationSize = [int][Math]::Round($Size * $Scale)
  $destinationOffset = [int][Math]::Round(($Size - $destinationSize) / 2)
  $cropInset = 78
  $sourceWidth = $source.Width - 2 * $cropInset
  $sourceHeight = $source.Height - 2 * $cropInset
  $sourceRect = [System.Drawing.Rectangle]::new($cropInset, $cropInset, $sourceWidth, $sourceHeight)
  $destinationRect = [System.Drawing.Rectangle]::new($destinationOffset, $destinationOffset, $destinationSize, $destinationSize)
  $graphics.DrawImage($source, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
  $bitmap.Save((Join-Path $images $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

function Save-MonochromeVariant([string]$Name, [int]$Size) {
  $canvas = New-Canvas $Size $true
  $bitmap = $canvas[0]
  $graphics = $canvas[1]
  $graphics.Dispose()
  $padding = 52
  $content = $Size - 2 * $padding
  $cropInset = 78
  $cropSize = $source.Width - 2 * $cropInset

  for ($y = 0; $y -lt $content; $y += 1) {
    $sourceY = $cropInset + [int][Math]::Floor(($y / [double]$content) * $cropSize)
    for ($x = 0; $x -lt $content; $x += 1) {
      $sourceX = $cropInset + [int][Math]::Floor(($x / [double]$content) * $cropSize)
      $pixel = $source.GetPixel($sourceX, $sourceY)
      $isWhiteMark = $pixel.R -gt 175 -and $pixel.G -gt 175 -and $pixel.B -gt 175
      $isRedJoint = $pixel.R -gt 175 -and $pixel.G -lt 175 -and $pixel.B -lt 175
      if ($isWhiteMark -or $isRedJoint) {
        $bitmap.SetPixel($padding + $x, $padding + $y, [System.Drawing.Color]::White)
      }
    }
  }

  $bitmap.Save((Join-Path $images $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

Save-SourceVariant 'icon.png' 1024 1.0 $false
Save-SourceVariant 'splash-icon.png' 512 0.86 $true
Save-SourceVariant 'android-icon-foreground.png' 1024 0.76 $true
Save-SourceVariant 'favicon.png' 64 1.0 $false
Save-SourceVariant 'form-logo-mark.png' 256 1.0 $true
Save-MonochromeVariant 'android-icon-monochrome.png' 432

$background = New-Canvas 1024 $false
$background[0].Save((Join-Path $images 'android-icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$background[1].Dispose()
$background[0].Dispose()
$source.Dispose()

Write-Output 'Generated FORM launcher, adaptive, monochrome, splash, favicon, and in-app logo assets from form-logo-source.png.'
