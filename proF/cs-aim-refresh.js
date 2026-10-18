/* CS平面版 · 人机准星刷新策略
 *
 * 需求：开局就把人机准星刷到玩家附近，之后每 15 秒再刷一次。
 * 做法：作为独立的运行时脚本，只设置"人机准星"这个精灵的坐标（它本身是隐藏的），
 *       完全不改任何积木，避免动到项目结构。
 *
 * 用法：在游戏页面末尾加 <script src="cs-aim-refresh.js"></script>
 */
(function () {
  'use strict';
  if (window.__ycAim) { return; }
  window.__ycAim = true;

  var OFFSET = 20;        /* 在玩家周围 ±20 单位内随机（每 15 秒的常规刷新） */
  var DAMAGE_OFFSET = 6;  /* 人机被击中时：几乎直接对准玩家（±6） */
  var PERIOD = 15000;     /* 每 15 秒刷新一次 */
  var STAGE_X = 232;      /* 舞台边界（留少量余量） */
  var STAGE_Y = 172;

  var player = null;
  var aim = null;
  var lastAt = 0;
  var stats = { refreshes: 0, damageRefreshes: 0 };

  function find(name) {
    var vm = window.vm;
    if (!vm || !vm.runtime || !vm.runtime.targets) { return null; }
    for (var i = 0; i < vm.runtime.targets.length; i++) {
      var t = vm.runtime.targets[i];
      if (t.sprite && t.sprite.name === name) { return t; }
    }
    return null;
  }

  function clamp(v, lim) { return v < -lim ? -lim : (v > lim ? lim : v); }

  function refresh(offset) {
    if (!player) { player = find('玩家'); }
    if (!aim) { aim = find('人机准星'); }
    if (!player || !aim) { return false; }
    if (typeof player.x !== 'number' || typeof aim.setXY !== 'function') { return false; }
    var range = (typeof offset === 'number') ? offset : OFFSET;
    var ox = (Math.random() * 2 - 1) * range;
    var oy = (Math.random() * 2 - 1) * range;
    var x = clamp(player.x + ox, STAGE_X);
    var y = clamp(player.y + oy, STAGE_Y);
    try { aim.setXY(x, y); } catch (e) { return false; }
    lastAt = Date.now();
    stats.refreshes++;
    stats.lastX = Math.round(x);
    stats.lastY = Math.round(y);
    stats.playerX = Math.round(player.x);
    stats.playerY = Math.round(player.y);
    return true;
  }

  /* ---------- 人机受伤检测：读全局变量「玩家 / 人机」，任一变化即视为一次命中 ---------- */
  function readVar(vm, name) {
    try {
      if (!vm || !vm.runtime) { return null; }
      var stage = vm.runtime.getTargetForStage ? vm.runtime.getTargetForStage() : null;
      if (stage && stage.lookupVariableByNameAndType) {
        var v = stage.lookupVariableByNameAndType(name, '');
        if (v) { return Number(v.value); }
      }
      if (stage && stage.variables) {
        for (var k in stage.variables) {
          var sv = stage.variables[k];
          if (sv && sv.name === name) { return Number(sv.value); }
        }
      }
    } catch (e) {}
    return null;
  }

  var lastP = null, lastA = null;

  function watchDamage() {
    var vm = window.vm;
    var p = readVar(vm, '玩家');
    var a = readVar(vm, '人机');
    if (p === null && a === null) { return; }
    if (lastP !== null && (p !== lastP || a !== lastA)) {
      stats.damageRefreshes++;
      refresh(DAMAGE_OFFSET);   /* 立刻把准星压到玩家身上 */
    }
    lastP = p;
    lastA = a;
  }

  /* 开局尽快刷一次（等虚拟机把精灵都建好） */
  var firstTries = 0;
  var firstTimer = setInterval(function () {
    firstTries++;
    if (refresh() || firstTries > 100) { clearInterval(firstTimer); }
  }, 200);

  /* 之后每 15 秒一次 */
  var timer = setInterval(function () {
    if (Date.now() - lastAt >= PERIOD) { refresh(); }
  }, 500);

  /* 受伤监测（100ms 轮询全局变量） */
  var damageTimer = setInterval(watchDamage, 100);

  window.addEventListener('pagehide', function () {
    clearInterval(firstTimer);
    clearInterval(timer);
    clearInterval(damageTimer);
  });

  /* 调试接口 */
  window.__ycAimStats = function () { return JSON.parse(JSON.stringify(stats)); };
  window.__ycAimConfig = function () { return { offset: OFFSET, damageOffset: DAMAGE_OFFSET, period: PERIOD }; };
  window.__ycAimRefresh = refresh;
  window.__ycAimWatchDamage = watchDamage;
})();
