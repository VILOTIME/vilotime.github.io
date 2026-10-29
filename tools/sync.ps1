<#
.SYNOPSIS
    一键同步「Vilotime 个人主页」——sites.json（分站点卡片）+ profile.json（头像 / 网页图标）→ index.html

.DESCRIPTION
    改完 json 之后跑一次，把 index.html 里由脚本维护的几个标记区间对齐数据文件。
    底层就是 node script/sync-html.js，这里负责：找 node、先校验两个 json、
    跑完把结果留住、报错看得懂。

    两类数据的处理方式不一样：
      · 分站点卡片：http 下浏览器会 fetch sites.json 现渲染，HTML 里这份是兜底；
      · 头像 / 网页图标：只在同步时写进 HTML，改完必须跑一次本脚本。

.PARAMETER Check
    只检查有没有不一致，不写文件。适合放进提交前检查或 CI。

.PARAMETER Serve
    同步完顺手起本地预览（node script/dev.js），改完 json 保存会自动再同步。
    注意：双击 index.html（file://）时浏览器不允许 fetch sites.json，看到的是静态兜底；
    走本地预览才是「卡片 json 实时生效」的效果。

.PARAMETER NoPause
    跑完不停留（给其他脚本 / 命令行里连续调用用）。双击运行时不要加这个，否则窗口会一闪而过。

.EXAMPLE
    .\tools\sync.ps1
    同步并停留，看结果

.EXAMPLE
    .\tools\sync.ps1 -Check -NoPause
    只检查，供脚本 / CI 调用

.EXAMPLE
    .\tools\sync.ps1 -Serve
    同步后直接起本地预览（Ctrl + C 结束）
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$Serve,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$syncScript = Join-Path $repoRoot 'script\sync-html.js'
$sitesFile = Join-Path $repoRoot 'sites.json'
$profileFile = Join-Path $repoRoot 'profile.json'
$devScript = Join-Path $repoRoot 'script\dev.js'

function Write-Head($text) {
    Write-Host ''
    Write-Host "=== $text ===" -ForegroundColor Cyan
}
function Fail($text) {
    Write-Host ''
    Write-Host "[失败] $text" -ForegroundColor Red
}
function Pause-IfNeeded {
    if (-not $NoPause) { Read-Host '按回车关闭' | Out-Null }
}

Write-Head 'Vilotime · 页面数据同步'
Write-Host ("仓库：{0}" -f $repoRoot) -ForegroundColor DarkGray

# ---------- 1. 环境检查 ----------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail '没找到 node。装一个 Node.js（https://nodejs.org/）后重开这个窗口。'
    Pause-IfNeeded
    exit 1
}
Write-Host ("node：{0}" -f (& node -v)) -ForegroundColor DarkGray

foreach ($f in @($sitesFile, $profileFile)) {
    if (-not (Test-Path $f)) {
        Fail ("找不到 {0}" -f (Split-Path -Leaf $f))
        Pause-IfNeeded
        exit 1
    }
}
if (-not (Test-Path $syncScript)) {
    Fail "找不到同步脚本：$syncScript"
    Pause-IfNeeded
    exit 1
}

# ---------- 2. 先校验两个 json 能不能读 ----------
function Read-Json($path) {
    try {
        $text = Get-Content -LiteralPath $path -Raw -Encoding UTF8
        return $text | ConvertFrom-Json
    } catch {
        Fail (('{0} 不是合法 JSON，先修好再同步：' -f (Split-Path -Leaf $path)) + $_.Exception.Message)
        Pause-IfNeeded
        exit 1
    }
}

$profile = Read-Json $profileFile
$avatarSrc = if ($profile.avatar) { $profile.avatar.src } else { '' }
$faviconSrc = if ($profile.favicon) { $profile.favicon.src } else { '' }
Write-Host 'profile.json：' -ForegroundColor Gray
Write-Host ("  · 头像：{0}" -f $(if ($avatarSrc) { $avatarSrc } else { '（未配置）' })) -ForegroundColor Gray
Write-Host ("  · 图标：{0}" -f $(if ($faviconSrc) { $faviconSrc } else { '（未配置）' })) -ForegroundColor Gray

$json = Read-Json $sitesFile
$sites = @($json.sites)
$placeholders = @($sites | Where-Object { -not $_.href -or $_.href -eq '#' })
Write-Host ("sites.json：{0} 个分站点（其中 {1} 个还没配链接）" -f $sites.Count, $placeholders.Count) -ForegroundColor Gray
foreach ($s in $sites) {
    $link = if (-not $s.href -or $s.href -eq '#') { '（占位）' } else { $s.href }
    Write-Host ("  · {0} → {1}" -f $s.title, $link) -ForegroundColor Gray
}

# ---------- 3. 跑同步 ----------
Write-Head ($(if ($Check) { '检查（不写文件）' } else { '同步 index.html' }))
$nodeArgs = @($syncScript)
if ($Check) { $nodeArgs += '--check' }

$before = (Get-Date)
& node @nodeArgs
$code = $LASTEXITCODE
$elapsed = [math]::Round(((Get-Date) - $before).TotalMilliseconds)

Write-Host ''
if ($code -eq 0) {
    Write-Host ("[完成] 用时 {0} ms" -f $elapsed) -ForegroundColor Green
} else {
    Fail "同步脚本返回 $code，看上面的报错。"
}

# ---------- 4. 可选：起本地预览 ----------
if ($Serve -and $code -eq 0) {
    Write-Head '启动本地预览（Ctrl + C 结束）'
    & node $devScript
}

Pause-IfNeeded
exit $code
