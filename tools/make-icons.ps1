<#
.SYNOPSIS
    生成站点的整套图标文件（favicon.ico / PNG 各尺寸 / apple-touch-icon）

.DESCRIPTION
    搜索引擎（尤其是 Bing）不认 SVG favicon，也不一定会去读 <link rel="icon">，
    它们通常直接请求站点根目录的 /favicon.ico。抓不到就退回托管域名的图标
    —— 在 GitHub Pages 上就是你看到的 GitHub 小图标。

    这个脚本一次生成所有需要的文件：
      favicon.ico                     根目录（16/32/48 三种尺寸打包在一个 ICO 里）
      assets/img/icon-16.png
      assets/img/icon-32.png
      assets/img/icon-192.png
      assets/img/icon-512.png
      assets/img/apple-touch-icon.png 180×180

.PARAMETER Design
    monogram = 渐变底 + 白色 V（默认，和 favicon.svg 一致）
    avatar   = 直接把头像裁成圆形做图标

.EXAMPLE
    .\tools\make-icons.ps1
    用 V 字标生成整套图标

.EXAMPLE
    .\tools\make-icons.ps1 -Design avatar
    用头像照片生成整套图标
#>
[CmdletBinding()]
param(
    [ValidateSet('monogram', 'avatar')]
    [string]$Design = 'monogram'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$imgDir = Join-Path $repoRoot 'assets\img'
if (-not (Test-Path $imgDir)) { throw "找不到 $imgDir" }

# 和 favicon.svg 保持一致的三段渐变
$c1 = [System.Drawing.Color]::FromArgb(255, 91, 123, 255)    # #5b7bff
$c2 = [System.Drawing.Color]::FromArgb(255, 157, 107, 255)   # #9d6bff
$c3 = [System.Drawing.Color]::FromArgb(255, 47, 211, 189)    # #2fd3c0

function New-RoundedPath([int]$size, [double]$radiusRatio) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = [int]($size * $radiusRatio)
    if ($r -lt 1) { $r = 1 }
    $d = $r * 2
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc(($size - $d), 0, $d, $d, 270, 90)
    $path.AddArc(($size - $d), ($size - $d), $d, $d, 0, 90)
    $path.AddArc(0, ($size - $d), $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-IconBitmap([int]$size, [bool]$round) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c3, 45)
    $blend = New-Object System.Drawing.Drawing2D.ColorBlend 3
    $blend.Colors = @($c1, $c2, $c3)
    $blend.Positions = @(0.0, 0.5, 1.0)
    $brush.InterpolationColors = $blend

    $radius = if ($round) { 0.5 } else { 0.22 }
    $path = New-RoundedPath $size $radius
    $g.FillPath($brush, $path)

    if ($Design -eq 'avatar') {
        $avatarFile = Join-Path $imgDir 'avatar-400.jpg'
        if (-not (Test-Path $avatarFile)) { $avatarFile = Join-Path $imgDir 'avatar.jpg' }
        $avatar = [System.Drawing.Image]::FromFile($avatarFile)
        # 圆形裁切，留一点边
        $inset = [int]($size * 0.06)
        $inner = $size - ($inset * 2)
        $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
        $clip.AddEllipse($inset, $inset, $inner, $inner)
        $g.SetClip($clip)
        $g.DrawImage($avatar, (New-Object System.Drawing.Rectangle $inset, $inset, $inner, $inner))
        $g.ResetClip()
        $avatar.Dispose()
    } else {
        $fontSize = [math]::Round($size * 0.66)
        if ($fontSize -lt 7) { $fontSize = 7 }
        $font = New-Object System.Drawing.Font('Microsoft YaHei', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(250, 255, 255, 255))
        $fmt = New-Object System.Drawing.StringFormat
        $fmt.Alignment = [System.Drawing.StringAlignment]::Center
        $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
        # 视觉重心略微上移一点，看起来更居中
        $box = New-Object System.Drawing.RectangleF(0, (-$size * 0.02), $size, $size)
        $g.DrawString('V', $font, $white, $box, $fmt)
        $font.Dispose(); $white.Dispose()
    }

    $g.Dispose()
    return $bmp
}

function Save-Png($bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $kb = [math]::Round((Get-Item $path).Length / 1KB, 1)
    "  {0,-34} {1,4}x{1,-4} {2,6} KB" -f (Split-Path $path -Leaf), $bmp.Width, $kb
}

function Get-PngBytes($bmp) {
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    return $bytes
}

Write-Host ("生成图标（设计：{0}）" -f $Design) -ForegroundColor Cyan

# ---------- 1. 各个 PNG ----------
$pngTargets = @(
    @{ Size = 16; File = 'icon-16.png'; Round = $false },
    @{ Size = 32; File = 'icon-32.png'; Round = $false },
    @{ Size = 192; File = 'icon-192.png'; Round = $false },
    @{ Size = 512; File = 'icon-512.png'; Round = $false },
    @{ Size = 180; File = 'apple-touch-icon.png'; Round = ($Design -eq 'avatar') }
)

foreach ($t in $pngTargets) {
    $bmp = New-IconBitmap $t.Size ([bool]$t.Round)
    Save-Png $bmp (Join-Path $imgDir $t.File)
    $bmp.Dispose()
}

# ---------- 2. favicon.ico（16/32/48 + 192，PNG 内嵌，Vista 以后都支持） ----------
# 为什么要把 192 也塞进去：有些浏览器/系统只认 /favicon.ico，既不读 <link> 也不读 manifest，
# 里面没有大图时它们会把 48 放大到桌面/主屏尺寸，结果就是图标发糊。
$icoSizes = @(16, 32, 48, 192)
$entries = @()
foreach ($s in $icoSizes) {
    $bmp = New-IconBitmap $s $false
    $entries += [pscustomobject]@{ Size = $s; Bytes = (Get-PngBytes $bmp) }
    $bmp.Dispose()
}

$icoPath = Join-Path $repoRoot 'favicon.ico'
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)                 # reserved
$bw.Write([uint16]1)                 # type = icon
$bw.Write([uint16]$entries.Count)    # 图像数量

$offset = 6 + (16 * $entries.Count)
foreach ($e in $entries) {
    $bw.Write([byte]$e.Size)         # 宽度
    $bw.Write([byte]$e.Size)         # 高度
    $bw.Write([byte]0)               # 调色板数量
    $bw.Write([byte]0)               # 保留
    $bw.Write([uint16]1)             # color planes
    $bw.Write([uint16]32)            # 位深
    $bw.Write([uint32]$e.Bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $e.Bytes.Length
}
foreach ($e in $entries) { $bw.Write([byte[]]$e.Bytes) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

"  {0,-34} {1,6} KB（含 {2}）" -f 'favicon.ico', ([math]::Round((Get-Item $icoPath).Length / 1KB, 1)), (($icoSizes | ForEach-Object { "${_}px" }) -join ' / ')

# ---------- 3. 回读校验 ----------
Write-Host ''
Write-Host '回读校验：' -ForegroundColor Cyan
$ico = New-Object System.Drawing.Icon($icoPath)
"  favicon.ico 可被系统识别：{0}x{1}" -f $ico.Width, $ico.Height
$ico.Dispose()

foreach ($t in $pngTargets) {
    $p = Join-Path $imgDir $t.File
    $im = [System.Drawing.Image]::FromFile($p)
    $ok = ($im.Width -eq $t.Size -and $im.Height -eq $t.Size)
    "  {0,-24} {1}x{1}  {2}" -f $t.File, $im.Width, $(if ($ok) { 'OK' } else { '尺寸不对！' })
    $im.Dispose()
}

Write-Host ''
Write-Host '完成。记得跑一次 tools\sync.cmd 把 JSON 里的配置写进 index.html。' -ForegroundColor Green
