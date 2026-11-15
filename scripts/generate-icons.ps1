param(
  [string]$Source = (Join-Path $PSScriptRoot '..\AI comment icon.png'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\icons')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$sizes = 16, 32, 48, 128
$sourceImage = [System.Drawing.Image]::FromFile($sourcePath)
try {
  foreach ($size in $sizes) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

      $scale = [Math]::Min($size / $sourceImage.Width, $size / $sourceImage.Height)
      $width = [int][Math]::Round($sourceImage.Width * $scale)
      $height = [int][Math]::Round($sourceImage.Height * $scale)
      $x = [int][Math]::Floor(($size - $width) / 2)
      $y = [int][Math]::Floor(($size - $height) / 2)
      $graphics.DrawImage($sourceImage, [System.Drawing.Rectangle]::new($x, $y, $width, $height))

      $destination = Join-Path $OutputDirectory "icon$size.png"
      $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Host "Generated $destination"
    }
    finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  }
}
finally {
  $sourceImage.Dispose()
}
