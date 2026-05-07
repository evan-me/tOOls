Add-Type -AssemblyName System.Drawing

$S = 512
$bmp = New-Object System.Drawing.Bitmap($S, $S)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Helper: build a rounded-rect GraphicsPath
function New-RoundedPath($x, $y, $w, $h, $r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x,       $y,       $r*2, $r*2, 180, 90)
    $p.AddArc($x+$w-$r*2, $y,       $r*2, $r*2, 270, 90)
    $p.AddArc($x+$w-$r*2, $y+$h-$r*2, $r*2, $r*2,   0, 90)
    $p.AddArc($x,       $y+$h-$r*2, $r*2, $r*2,  90, 90)
    $p.CloseFigure()
    return $p
}

# ── BACKGROUND ───────────────────────────────────────────────
$bgPath = New-RoundedPath 0 0 $S $S 96

$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Rectangle]::new(0,0,$S,$S),
    [System.Drawing.Color]::FromArgb(255, 10, 8, 30),
    [System.Drawing.Color]::FromArgb(255, 38, 14, 72),
    40.0)
$g.FillPath($bgBrush, $bgPath)
$bgBrush.Dispose()

# subtle top-center radial highlight
$topGlow = New-Object System.Drawing.Drawing2D.PathGradientBrush($bgPath)
$topGlow.CenterPoint = New-Object System.Drawing.PointF(($S/2), 30)
$topGlow.CenterColor = [System.Drawing.Color]::FromArgb(22, 160, 140, 255)
$topGlow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
$g.FillPath($topGlow, $bgPath)
$topGlow.Dispose()

# ── BAR PAINTER ───────────────────────────────────────────────
function Paint-Bar($bx, $by, $bw, $bh, $br, $c1, $c2) {
    # glow layers
    foreach ($gi in @(22, 14, 7)) {
        $a = [int](18 * (1 - $gi/22.0))
        $gc = [System.Drawing.Color]::FromArgb($a, $c1.R, $c1.G, $c1.B)
        $gb = New-Object System.Drawing.SolidBrush($gc)
        $gp = New-RoundedPath ($bx-$gi) ($by-($gi/2)) ($bw+$gi*2) ($bh+$gi) ($br+$gi/2)
        $g.FillPath($gb, $gp)
        $gb.Dispose()
        $gp.Dispose()
    }
    # main bar gradient
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::new($bx,$by,$bw,$bh),
        $c1, $c2, 0.0)
    $barPath = New-RoundedPath $bx $by $bw $bh $br
    $g.FillPath($grad, $barPath)
    # top shine
    $shinePath = New-RoundedPath $bx $by $bw ($bh/2) $br
    $shine = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        [System.Drawing.Rectangle]::new($bx,$by,$bw,($bh/2)),
        [System.Drawing.Color]::FromArgb(55,255,255,255),
        [System.Drawing.Color]::FromArgb(0,255,255,255),
        90.0)
    $g.FillPath($shine, $shinePath)
    $shine.Dispose()
    $shinePath.Dispose()
    $grad.Dispose()
    $barPath.Dispose()
}

$barH = 60
$barR = 30
$padX = 72

# Bar 1 — Pink  (full width, y=140)
Paint-Bar $padX 140 ($S-$padX*2) $barH $barR `
    ([System.Drawing.Color]::FromArgb(255,244, 63, 94)) `
    ([System.Drawing.Color]::FromArgb(255,251,113,133))

# Bar 2 — Violet  (narrower by 68px each side, y=228)
$off2 = 42
Paint-Bar ($padX+$off2) 228 ($S-$padX*2-$off2*2) $barH $barR `
    ([System.Drawing.Color]::FromArgb(255,139, 92,246)) `
    ([System.Drawing.Color]::FromArgb(255,167,139,250))

# Bar 3 — Sky  (narrower again, y=316)
$off3 = 84
Paint-Bar ($padX+$off3) 316 ($S-$padX*2-$off3*2) $barH $barR `
    ([System.Drawing.Color]::FromArgb(255, 14,165,233)) `
    ([System.Drawing.Color]::FromArgb(255, 56,189,248))

# ── RIM LIGHT ─────────────────────────────────────────────────
$rimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45,220,210,255), 2.5)
$g.DrawPath($rimPen, $bgPath)
$rimPen.Dispose()
$bgPath.Dispose()

$g.Dispose()

# Save 512 × 512 app icon
$outDir = Split-Path $PSScriptRoot -Parent
$bmp.Save("$outDir\assets\app-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Save 32 × 32 tray icon (monochrome-friendly small version)
$trayBmp = New-Object System.Drawing.Bitmap($bmp, 32, 32)
$trayBmp.Save("$outDir\assets\tray-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$trayBmp.Dispose()

$bmp.Dispose()
Write-Host "Icons generated: assets/app-icon.png (512x512) and assets/tray-icon.png (32x32)"
