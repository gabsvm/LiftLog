Add-Type -AssemblyName System.Drawing

$assetsDirectory = Resolve-Path (Join-Path $PSScriptRoot '..\assets')
$acid = [System.Drawing.Color]::FromArgb(255, 198, 255, 0)
$ink = [System.Drawing.Color]::FromArgb(255, 11, 13, 12)
$transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $diameter = $Radius * 2
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc(
    $X + $Width - $diameter,
    $Y + $Height - $diameter,
    $diameter,
    $diameter,
    0,
    90
  )
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Canvas {
  param(
    [int]$Size,
    [System.Drawing.Color]$Background
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode =
    [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode =
    [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear($Background)
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Add-GainsLabGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size,
    [System.Drawing.Color]$Color
  )

  $brush = [System.Drawing.SolidBrush]::new($Color)
  $barWidth = $Size * 0.105
  $baseline = $Y + ($Size * 0.76)
  $barGap = $Size * 0.055
  $barX = $X + ($Size * 0.20)
  $heights = @(0.17, 0.25, 0.34, 0.45)

  for ($index = 0; $index -lt $heights.Count; $index++) {
    $height = $Size * $heights[$index]
    $rectangle = New-RoundedRectanglePath `
      -X ($barX + (($barWidth + $barGap) * $index)) `
      -Y ($baseline - $height) `
      -Width $barWidth `
      -Height $height `
      -Radius ($barWidth * 0.16)
    $Graphics.FillPath($brush, $rectangle)
    $rectangle.Dispose()
  }

  $linePen = [System.Drawing.Pen]::new($Color, $Size * 0.065)
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = @(
    [System.Drawing.PointF]::new($X + ($Size * 0.18), $Y + ($Size * 0.53)),
    [System.Drawing.PointF]::new($X + ($Size * 0.36), $Y + ($Size * 0.46)),
    [System.Drawing.PointF]::new($X + ($Size * 0.54), $Y + ($Size * 0.35)),
    [System.Drawing.PointF]::new($X + ($Size * 0.72), $Y + ($Size * 0.18))
  )
  $Graphics.DrawLines($linePen, $points)

  $arrow = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X + ($Size * 0.60), $Y + ($Size * 0.18)),
    [System.Drawing.PointF]::new($X + ($Size * 0.75), $Y + ($Size * 0.15)),
    [System.Drawing.PointF]::new($X + ($Size * 0.72), $Y + ($Size * 0.30))
  )
  $Graphics.FillPolygon($brush, $arrow)
  $Graphics.FillEllipse(
    $brush,
    $X + ($Size * 0.72),
    $Y + ($Size * 0.05),
    $Size * 0.105,
    $Size * 0.105
  )

  $linePen.Dispose()
  $brush.Dispose()
}

function Add-GainsLabMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $markPath = New-RoundedRectanglePath `
    -X $X `
    -Y $Y `
    -Width $Size `
    -Height $Size `
    -Radius ($Size * 0.28)
  $markBrush = [System.Drawing.SolidBrush]::new($acid)
  $Graphics.FillPath($markBrush, $markPath)
  Add-GainsLabGlyph `
    -Graphics $Graphics `
    -X ($X + ($Size * 0.12)) `
    -Y ($Y + ($Size * 0.12)) `
    -Size ($Size * 0.76) `
    -Color $ink
  $markBrush.Dispose()
  $markPath.Dispose()
}

function Save-Png {
  param(
    [hashtable]$Canvas,
    [string]$Name
  )

  $path = Join-Path $assetsDirectory $Name
  $Canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Canvas.Graphics.Dispose()
  $Canvas.Bitmap.Dispose()
  Write-Output "Generated $path"
}

$splash = New-Canvas -Size 512 -Background $transparent
Add-GainsLabMark -Graphics $splash.Graphics -X 40 -Y 40 -Size 432
Save-Png -Canvas $splash -Name 'gainslab-splash.png'

$icon = New-Canvas -Size 1024 -Background $ink
Add-GainsLabMark -Graphics $icon.Graphics -X 142 -Y 142 -Size 740
Save-Png -Canvas $icon -Name 'gainslab-icon-clean.png'

$adaptiveForeground = New-Canvas -Size 1024 -Background $transparent
Add-GainsLabMark `
  -Graphics $adaptiveForeground.Graphics `
  -X 222 `
  -Y 222 `
  -Size 580
Save-Png `
  -Canvas $adaptiveForeground `
  -Name 'gainslab-adaptive-foreground.png'

$monochrome = New-Canvas -Size 432 -Background $transparent
Add-GainsLabGlyph `
  -Graphics $monochrome.Graphics `
  -X 72 `
  -Y 72 `
  -Size 288 `
  -Color ([System.Drawing.Color]::White)
Save-Png -Canvas $monochrome -Name 'gainslab-monochrome-clean.png'
