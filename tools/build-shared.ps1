# Injecte les blocs partagés (header, drawer, footer, actions flottantes) depuis
# index.html vers les autres pages. Idempotent : relançable après toute édition
# d'index.html — les régions injectées sont délimitées par des marqueurs.
#
# Usage : powershell -ExecutionPolicy Bypass -File tools/build-shared.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$index = [IO.File]::ReadAllText((Join-Path $root 'index.html'))

function Get-Block([string]$text, [string]$startNeedle, [string]$endNeedle, [bool]$includeEnd = $true) {
  $s = $text.IndexOf($startNeedle)
  if ($s -lt 0) { throw "Bloc introuvable : $startNeedle" }
  $e = $text.IndexOf($endNeedle, $s)
  if ($e -lt 0) { throw "Fin de bloc introuvable : $endNeedle" }
  if ($includeEnd) { $e += $endNeedle.Length }
  return $text.Substring($s, $e - $s).TrimEnd()
}

$blocks = @{
  HEADER   = Get-Block $index '<header class="site-header' '</header>' $true
  DRAWER   = Get-Block $index '<div class="scrim" id="scrim">' '</aside>' $true
  FOOTER   = Get-Block $index '<footer class="site-footer">' '</footer>' $true
  FLOATING = Get-Block $index '<div class="fab-stack">' '<script src="i18n.js" defer></script>' $false
}

# Lien de navigation actif par page (barre principale + tiroir).
$currentFor = @{
  'index.html'            = 'index.html'
  'services.html'         = 'services.html'
  'about.html'            = 'about.html'
  'booking.html'          = 'booking.html'
  'contact.html'          = 'contact.html'
  'mentions-legales.html' = 'mentions-legales.html'
  '404.html'              = ''
}

Get-ChildItem $root -Filter '*.html' | Where-Object { $_.Name -ne 'index.html' } | ForEach-Object {
  $file = $_.FullName
  $html = [IO.File]::ReadAllText($file)
  $changed = $false

  foreach ($name in $blocks.Keys) {
    $open  = "<!--#$name-->"
    $close = "<!--#/$name-->"
    $body  = "$open`r`n" + $blocks[$name] + "`r`n$close"

    $startIdx = $html.IndexOf($open)
    if ($startIdx -lt 0) { continue }

    $endIdx = $html.IndexOf($close, $startIdx)
    if ($endIdx -ge 0) {
      $html = $html.Substring(0, $startIdx) + $body + $html.Substring($endIdx + $close.Length)
    } else {
      $html = $html.Substring(0, $startIdx) + $body + $html.Substring($startIdx + $open.Length)
    }
    $changed = $true
  }

  if (-not $changed) { return }

  # L'index est la page active dans le bloc source : on la neutralise…
  $html = $html.Replace('<a class="nav-link" href="index.html" aria-current="page"', '<a class="nav-link" href="index.html"')
  $html = $html.Replace('<a href="index.html" aria-current="page">', '<a href="index.html">')

  # …puis on marque la page courante.
  $target = $currentFor[$_.Name]
  if ($target) {
    $html = $html.Replace("<a class=""nav-link"" href=""$target""", "<a class=""nav-link"" href=""$target"" aria-current=""page""")
    $html = $html.Replace("<a href=""$target"">", "<a href=""$target"" aria-current=""page"">")
    if ($target -eq 'services.html') {
      $html = $html.Replace('<button type="button" class="nav-link" aria-expanded="false">',
                            '<button type="button" class="nav-link" aria-expanded="false" aria-current="page">')
    }
  }

  [IO.File]::WriteAllText($file, $html, (New-Object Text.UTF8Encoding $false))
  "injecté → $($_.Name)"
}
