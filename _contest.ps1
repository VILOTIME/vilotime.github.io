$root = 'C:\Users\vilot\Codes\vilotime.github.io'

# ============ ① 三个足球游戏：卡球 → 争球 ============
$stuckTpl = @'
  /* ---- 卡球检测：球在角落/墙边长时间不动，判为死球 → 争球 ---- */
  var _bs = len(ball.vx, ball.vy);
  var _nearCorner = (Math.abs(ball.x) > FIELD.right - 34) && (Math.abs(ball.y) > FIELD.top - 34);
  if (_bs < 30 && (_nearCorner || _bs < 5)) { stuckTimer += dt; } else { stuckTimer = 0; }
  if (stuckTimer > 1.2) {
    stuckTimer = 0;
    ball.x = 0; ball.y = 0; ball.vx = 0; ball.vy = 0;
    BODY_A.x = -110; BODY_A.y = 0; BODY_A.vx = 0; BODY_A.vy = 0;
    BODY_B.x = 110; BODY_B.y = 0; BODY_B.vx = 0; BODY_B.vy = 0;
    if (typeof banner === 'function') { banner('争球！', 1000); }
    if (typeof msg === 'function') { msg('争球！', 900); }
  }
'@
$targets = @(
  @{ file = "$root\proF\双人足球.html";     a = 'you'; b = 'ai';  anchor = 'collideBall(ai);' },
  @{ file = "$root\proF\人机对战足球.html"; a = 'you'; b = 'ai';  anchor = 'collideBall(ai);' },
  @{ file = "$root\proF\玩家对战足球.html"; a = 'p1';  b = 'p2';  anchor = 'collideBall(p2);' }
)
foreach ($t in $targets) {
  $c = [System.IO.File]::ReadAllText($t.file)
  $name = Split-Path $t.file -Leaf
  if ($c -match 'stuckTimer > 1\.2') { Write-Output ('· ' + $name + ' 已有争球逻辑'); continue }
  if (-not $c.Contains($t.anchor)) { Write-Output ('✗ ' + $name + ' 找不到锚点 ' + $t.anchor); continue }
  $inject = $stuckTpl.Replace('BODY_A', $t.a).Replace('BODY_B', $t.b)
  $c = $c.Replace($t.anchor, $t.anchor + "`r`n" + $inject)
  # 声明 stuckTimer
  if ($c -notmatch 'var stuckTimer') {
    $c = $c.Replace('var touchTarget = null;', 'var touchTarget = null;' + "`r`n" + 'var stuckTimer = 0;   /* 卡球计时 */')
    if ($c -notmatch 'var stuckTimer') { $c = $c.Replace('var keys = {};', 'var keys = {};' + "`r`n" + 'var stuckTimer = 0;') }
  }
  [System.IO.File]::WriteAllText($t.file, $c)
  Write-Output ('✓ ' + $name + ' 已加入争球逻辑')
}

# ============ ② 玩家对战足球：换夜间球场背景 ============
$pvp = "$root\proF\玩家对战足球.html"
$c = [System.IO.File]::ReadAllText($pvp)
$s = $c.IndexOf('function drawField() {')
$e = $c.IndexOf('function drawDisc(')
if ($s -lt 0 -or $e -lt 0 -or $e -le $s) { Write-Output '✗ 玩家对战足球 找不到 drawField'; }
else {
  $newField = @'
function drawField() {
  /* 夜间球场：左半场偏蓝、右半场偏红，中线有灯光 */
  var g1 = ctx.createLinearGradient(FIELD.left - 20, 0, 0, 0);
  g1.addColorStop(0, '#0f2c46'); g1.addColorStop(1, '#17496b');
  ctx.fillStyle = g1; ctx.fillRect(FIELD.left - 20, -H / 2, W / 2 + 20, H);
  var g2 = ctx.createLinearGradient(0, 0, FIELD.right + 20, 0);
  g2.addColorStop(0, '#3d1a22'); g2.addColorStop(1, '#6b2b33');
  ctx.fillStyle = g2; ctx.fillRect(0, -H / 2, W / 2 + 20, H);
  /* 草皮条纹 */
  for (var i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(-W / 2 + i * (W / 10), -H / 2, W / 10, H);
  }
  /* 中线灯光 */
  var glow = ctx.createLinearGradient(-34, 0, 34, 0);
  glow.addColorStop(0, 'rgba(150,215,255,0)');
  glow.addColorStop(0.5, 'rgba(190,235,255,0.30)');
  glow.addColorStop(1, 'rgba(150,215,255,0)');
  ctx.fillStyle = glow; ctx.fillRect(-34, -H / 2, 68, H);
  /* 场地白线 */
  ctx.strokeStyle = 'rgba(226,240,255,0.55)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(FIELD.left, FIELD.bottom, FIELD.right - FIELD.left, FIELD.top - FIELD.bottom);
  ctx.beginPath(); ctx.moveTo(0, FIELD.bottom); ctx.lineTo(0, FIELD.top); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 46, 0, 6.2832); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, 6.2832); ctx.fillStyle = 'rgba(226,240,255,0.6)'; ctx.fill();
  /* 球门 */
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(110,205,255,0.95)';
  ctx.beginPath(); ctx.moveTo(FIELD.left, -GOAL_HALF); ctx.lineTo(FIELD.left, GOAL_HALF); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,130,130,0.95)';
  ctx.beginPath(); ctx.moveTo(FIELD.right, -GOAL_HALF); ctx.lineTo(FIELD.right, GOAL_HALF); ctx.stroke();
  ctx.fillStyle = 'rgba(110,205,255,0.12)';
  ctx.fillRect(FIELD.left - 20, -GOAL_HALF, 20, GOAL_HALF * 2);
  ctx.fillStyle = 'rgba(255,130,130,0.12)';
  ctx.fillRect(FIELD.right, -GOAL_HALF, 20, GOAL_HALF * 2);
}

'@
  $c = $c.Substring(0, $s) + $newField + $c.Substring($e)
  [System.IO.File]::WriteAllText($pvp, $c)
  Write-Output '✓ 玩家对战足球 已换成夜间球场'
}

Write-Output '--- 校验:'
foreach ($t in $targets) {
  $v = [System.IO.File]::ReadAllText($t.file)
  Write-Output ('  ' + (Split-Path $t.file -Leaf) + ' 争球=' + ($v -match 'stuckTimer > 1\.2') + ' 计时器声明=' + ($v -match 'var stuckTimer') + ' 大小=' + [math]::Round((Get-Item $t.file).Length/1KB) + 'KB')
}
$v2 = [System.IO.File]::ReadAllText($pvp)
Write-Output ('  夜间球场=' + ($v2 -match '夜间球场'))
