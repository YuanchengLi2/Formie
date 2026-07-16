Add-Type -AssemblyName System.Drawing

$images = Join-Path $PSScriptRoot '..\assets\images'
$images = [IO.Path]::GetFullPath($images)

function New-Canvas([int]$Size, [bool]$Transparent) {
  $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  if ($Transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#090909'))
  }
  return @($bitmap, $graphics)
}

function Draw-Mark($Graphics, [int]$Size, [string]$HexColor, [double]$Scale = 1.0) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($HexColor)
  $center = $Size / 2.0
  $half = $Size * 0.29 * $Scale
  $corner = $Size * 0.105 * $Scale
  $width = [Math]::Max(3, $Size * 0.017 * $Scale)
  $pen = New-Object System.Drawing.Pen($color, $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $left = $center - $half
  $right = $center + $half
  $top = $center - $half
  $bottom = $center + $half
  $Graphics.DrawLine($pen, $left, $top + $corner, $left, $top)
  $Graphics.DrawLine($pen, $left, $top, $left + $corner, $top)
  $Graphics.DrawLine($pen, $right - $corner, $top, $right, $top)
  $Graphics.DrawLine($pen, $right, $top, $right, $top + $corner)
  $Graphics.DrawLine($pen, $left, $bottom - $corner, $left, $bottom)
  $Graphics.DrawLine($pen, $left, $bottom, $left + $corner, $bottom)
  $Graphics.DrawLine($pen, $right - $corner, $bottom, $right, $bottom)
  $Graphics.DrawLine($pen, $right, $bottom - $corner, $right, $bottom)

  $fWidth = $width * 1.35
  $fPen = New-Object System.Drawing.Pen($color, $fWidth)
  $fPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $fPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $fx = $center - ($Size * 0.065 * $Scale)
  $fyTop = $center - ($Size * 0.145 * $Scale)
  $fyBottom = $center + ($Size * 0.155 * $Scale)
  $Graphics.DrawLine($fPen, $fx, $fyTop, $fx, $fyBottom)
  $Graphics.DrawLine($fPen, $fx, $fyTop, $center + ($Size * 0.13 * $Scale), $fyTop)
  $Graphics.DrawLine($fPen, $fx, $center - ($Size * 0.005 * $Scale), $center + ($Size * 0.075 * $Scale), $center - ($Size * 0.005 * $Scale))
  $pen.Dispose()
  $fPen.Dispose()
}

function Save-BrandImage([string]$Path, [int]$Size, [bool]$Transparent, [string]$Color, [double]$Scale = 1.0) {
  $canvas = New-Canvas $Size $Transparent
  $bitmap = $canvas[0]
  $graphics = $canvas[1]
  Draw-Mark $graphics $Size $Color $Scale
  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

Save-BrandImage (Join-Path $images 'icon.png') 1024 $false '#C8A96B' 1.0
Save-BrandImage (Join-Path $images 'splash-icon.png') 512 $true '#C8A96B' 0.92
Save-BrandImage (Join-Path $images 'android-icon-foreground.png') 1024 $true '#C8A96B' 0.72
Save-BrandImage (Join-Path $images 'android-icon-monochrome.png') 432 $true '#FFFFFF' 0.82
Save-BrandImage (Join-Path $images 'favicon.png') 64 $false '#C8A96B' 0.92

$background = New-Canvas 1024 $false
$background[0].Save((Join-Path $images 'android-icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$background[1].Dispose()
$background[0].Dispose()

Write-Output "Generated FORM launcher, adaptive, monochrome, splash, and favicon assets."
