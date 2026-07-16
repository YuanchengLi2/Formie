param(
  [Parameter(Mandatory = $true)][string]$ScreenRoot,
  [Parameter(Mandatory = $true)][string]$ClipboardRoot,
  [Parameter(Mandatory = $true)][string]$ExerciseSheet
)

Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path $PSScriptRoot -Parent
$outputRoot = Join-Path $projectRoot 'assets\production'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot 'icons') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $outputRoot 'exercise-families') | Out-Null

function Save-Crop {
  param(
    [string]$Source,
    [int]$X,
    [int]$Y,
    [int]$Width,
    [int]$Height,
    [string]$Destination,
    [switch]$AsMask
  )

  $sourceImage = [System.Drawing.Bitmap]::FromFile($Source)
  try {
    $rectangle = [System.Drawing.Rectangle]::new($X, $Y, $Width, $Height)
    $crop = $sourceImage.Clone($rectangle, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
      if ($AsMask) {
        for ($pixelY = 0; $pixelY -lt $crop.Height; $pixelY++) {
          for ($pixelX = 0; $pixelX -lt $crop.Width; $pixelX++) {
            $pixel = $crop.GetPixel($pixelX, $pixelY)
            $brightness = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
            $alpha = if ($brightness -lt 18) { 0 } else { [Math]::Min(255, [int](($brightness - 18) * 1.18)) }
            $crop.SetPixel($pixelX, $pixelY, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
          }
        }
      }
      $crop.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $crop.Dispose()
    }
  } finally {
    $sourceImage.Dispose()
  }
}

function Save-ExerciseFamily {
  param([System.Drawing.Bitmap]$Sheet, [int]$Column, [int]$Row, [string]$Name)
  $x0 = [int][Math]::Round($Column * $Sheet.Width / 4)
  $x1 = [int][Math]::Round(($Column + 1) * $Sheet.Width / 4)
  $y0 = [int][Math]::Round($Row * $Sheet.Height / 4)
  $y1 = [int][Math]::Round(($Row + 1) * $Sheet.Height / 4)
  $crop = $Sheet.Clone([System.Drawing.Rectangle]::new($x0, $y0, $x1 - $x0, $y1 - $y0), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    for ($pixelY = 0; $pixelY -lt $crop.Height; $pixelY++) {
      for ($pixelX = 0; $pixelX -lt $crop.Width; $pixelX++) {
        $pixel = $crop.GetPixel($pixelX, $pixelY)
        $isGreen = $pixel.G -gt 110 -and $pixel.G -gt ($pixel.R * 1.35) -and $pixel.G -gt ($pixel.B * 1.35)
        if ($isGreen) {
          $crop.SetPixel($pixelX, $pixelY, [System.Drawing.Color]::Transparent)
        } else {
          $brightness = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
          $alpha = [Math]::Min(255, [int]($brightness * 1.12))
          $crop.SetPixel($pixelX, $pixelY, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        }
      }
    }
    $crop.Save((Join-Path $outputRoot "exercise-families\$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $crop.Dispose()
  }
}

Save-Crop -Source (Join-Path $ScreenRoot '01-home.png') -X 43 -Y 518 -Width 813 -Height 605 -Destination (Join-Path $outputRoot 'home-record-card.png')
Save-Crop -Source (Join-Path $ScreenRoot '02-recording-tips.png') -X 46 -Y 366 -Width 807 -Height 636 -Destination (Join-Path $outputRoot 'recording-setup.png')
Save-Crop -Source (Join-Path $ScreenRoot '08-analysis-progress.png') -X 129 -Y 354 -Width 609 -Height 645 -Destination (Join-Path $outputRoot 'analysis-figure.png')
Copy-Item -LiteralPath (Join-Path $ClipboardRoot 'codex-clipboard-d2f5a81b-d5ce-4165-b7da-ad79faf385f8.png') -Destination (Join-Path $outputRoot 'camera-permission.png') -Force
Copy-Item -LiteralPath (Join-Path $ClipboardRoot 'codex-clipboard-900def86-f0bd-4e36-b79a-619ffdfa173b.png') -Destination (Join-Path $outputRoot 'progress-empty-graph.png') -Force

$tabs = Join-Path $ClipboardRoot 'codex-clipboard-699039bb-aea1-48a8-bb6d-c8eed9f96d5b.png'
Save-Crop -Source $tabs -X 20 -Y 1 -Width 34 -Height 32 -Destination (Join-Path $outputRoot 'icons\tab-home.png') -AsMask
Save-Crop -Source $tabs -X 134 -Y 1 -Width 39 -Height 33 -Destination (Join-Path $outputRoot 'icons\tab-progress.png') -AsMask
Save-Crop -Source $tabs -X 244 -Y 0 -Width 42 -Height 34 -Destination (Join-Path $outputRoot 'icons\tab-profile.png') -AsMask

$setup = Join-Path $ClipboardRoot 'codex-clipboard-7b510dbe-b7e5-48de-8018-bf9149ac0fa0.png'
Save-Crop -Source $setup -X 4 -Y 0 -Width 38 -Height 36 -Destination (Join-Path $outputRoot 'icons\setup-zoom.png') -AsMask
Save-Crop -Source $setup -X 4 -Y 39 -Width 38 -Height 40 -Destination (Join-Path $outputRoot 'icons\setup-bag.png') -AsMask
Save-Crop -Source $setup -X 4 -Y 81 -Width 38 -Height 40 -Destination (Join-Path $outputRoot 'icons\setup-person.png') -AsMask
Save-Crop -Source $setup -X 4 -Y 124 -Width 38 -Height 36 -Destination (Join-Path $outputRoot 'icons\info.png') -AsMask
Save-Crop -Source $setup -X 4 -Y 165 -Width 38 -Height 40 -Destination (Join-Path $outputRoot 'icons\warning.png') -AsMask

$stages = Join-Path $ClipboardRoot 'codex-clipboard-7bce8e60-1ba9-4772-8963-b2055120c07f.png'
Save-Crop -Source $stages -X 8 -Y 0 -Width 54 -Height 56 -Destination (Join-Path $outputRoot 'icons\stage-check.png') -AsMask
Save-Crop -Source $stages -X 8 -Y 87 -Width 56 -Height 58 -Destination (Join-Path $outputRoot 'icons\stage-video.png') -AsMask

$profile = Join-Path $ClipboardRoot 'codex-clipboard-169f3770-0419-4bf7-a08d-f08337846e22.png'
Save-Crop -Source $profile -X 13 -Y 5 -Width 54 -Height 66 -Destination (Join-Path $outputRoot 'icons\privacy-lock.png') -AsMask
Save-Crop -Source $profile -X 13 -Y 94 -Width 54 -Height 65 -Destination (Join-Path $outputRoot 'icons\video-storage.png') -AsMask
Save-Crop -Source $profile -X 13 -Y 181 -Width 54 -Height 68 -Destination (Join-Path $outputRoot 'icons\trash.png') -AsMask
Save-Crop -Source $profile -X 11 -Y 298 -Width 58 -Height 65 -Destination (Join-Path $outputRoot 'icons\complete-video.png') -AsMask
Save-Crop -Source $profile -X 9 -Y 389 -Width 65 -Height 70 -Destination (Join-Path $outputRoot 'icons\angle-coaching.png') -AsMask

$sheet = [System.Drawing.Bitmap]::FromFile($ExerciseSheet)
try {
  $families = @(
    @(0, 0, 'curl'), @(1, 0, 'triceps'), @(2, 0, 'press'), @(3, 0, 'overhead-press'),
    @(0, 1, 'fly'), @(1, 1, 'raise'), @(2, 1, 'row'), @(3, 1, 'pull-down'),
    @(0, 2, 'squat'), @(1, 2, 'lunge'), @(2, 2, 'hinge'), @(3, 2, 'hip-thrust'),
    @(0, 3, 'carry'), @(1, 3, 'core'), @(2, 3, 'plank'), @(3, 3, 'other')
  )
  foreach ($family in $families) { Save-ExerciseFamily -Sheet $sheet -Column $family[0] -Row $family[1] -Name $family[2] }
} finally {
  $sheet.Dispose()
}

Write-Output "Extracted production assets to $outputRoot"
