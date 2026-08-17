# Génère des dérivés d'images responsives (non destructif).
# Les originaux dans img/ ne sont jamais modifiés ; les versions optimisées vont dans img/opt/.
# Usage : powershell -ExecutionPolicy Bypass -File tools/optimize-images.ps1

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$src    = Join-Path $root 'img'
$outDir = Join-Path $src 'opt'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$widths  = @(1600, 800, 400)
$quality = 78L

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $quality

Get-ChildItem $src -File | Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' } | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $img  = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    foreach ($w in $widths) {
      if ($img.Width -le $w -and $w -ne $widths[0]) { continue }
      $targetW = [Math]::Min($w, $img.Width)
      $targetH = [int][Math]::Round($img.Height * ($targetW / $img.Width))
      $dest    = Join-Path $outDir ("{0}-{1}.jpg" -f $name, $w)

      $bmp = New-Object System.Drawing.Bitmap $targetW, $targetH
      $g   = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CompositingQuality = 'HighQuality'
      $g.InterpolationMode  = 'HighQualityBicubic'
      $g.SmoothingMode      = 'HighQuality'
      $g.PixelOffsetMode    = 'HighQuality'
      $g.Clear([System.Drawing.Color]::White)
      $g.DrawImage($img, 0, 0, $targetW, $targetH)
      $bmp.Save($dest, $codec, $params)
      $g.Dispose(); $bmp.Dispose()

      "{0,-34} {1,5}px  {2,6} KB" -f (Split-Path $dest -Leaf), $targetW, [math]::Round((Get-Item $dest).Length / 1KB)
    }
  } finally { $img.Dispose() }
}
