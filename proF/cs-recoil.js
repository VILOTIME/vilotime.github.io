/* CS平面版 · 玩家射击后坐力（准星四向震荡一次）
 *
 * 复刻初版设定：按下鼠标（或 Q 键）开火时，"玩家准星"按 上 → 下 → 左 → 右 各震荡
 * 一次再回正。连发判定不受影响。
 *
 * 关键点：游戏里准星的脚本是 `forever { go to 鼠标指针 }` —— 每帧都会被重设到鼠标位置，
 * 所以不能直接改精灵坐标（会被覆盖）。这里改为**临时给虚拟机的鼠标坐标加偏移**，
 * 让 `go to 鼠标指针` 自己算出带偏移的位置；偏移结束后归零，不产生漂移。
 *
 * 用法：在游戏页面末尾加 <script src="cs-recoil.js"></script>
 */
(function () {
  'use strict';
  if (window.__ycRecoil) { return; }
  window.__ycRecoil = true;

  var AMP = 6;       /* 震荡幅度（舞台单位）—— 取小一点，接近初版手感 */
  var STEP = 28;     /* 每段 28ms，五段共 140ms */
  var REPEAT = 140;  /* 按住连发时，每 140ms 重复一次后坐力 */

  /* 上 → 下 → 左 → 右 → 回中（Scratch 坐标：+y 向上，但鼠标 y 向下，符号在下面处理） */
  var SEQ = [
    [0, AMP],
    [0, -AMP],
    [-AMP, 0],
    [AMP, 0],
    [0, 0]
  ];

  var recoilT0 = -1;
  var stats = { shots: 0, active: false, hooked: false };

  function offsetNow() {
    if (recoilT0 < 0) { return { x: 0, y: 0 }; }
    var idx = Math.floor((Date.now() - recoilT0) / STEP);
    if (idx >= SEQ.length) { recoilT0 = -1; return { x: 0, y: 0 }; }
    return { x: SEQ[idx][0], y: SEQ[idx][1] };
  }

  /* 给鼠标坐标加偏移（鼠标 y 轴向下，所以屏幕方向要取反） */
  function hookMouse() {
    var vm = window.vm;
    if (!vm || !vm.runtime || !vm.runtime.ioDevices) { return false; }
    var m = vm.runtime.ioDevices.mouse;
    if (!m) { return false; }
    if (m.__ycRecoilHooked) { stats.hooked = true; return true; }

    var wrap = function (name, sign) {
      var orig = m[name];
      if (typeof orig !== 'function') { return; }
      m[name] = function () {
        var base = orig.apply(m, arguments);
        if (typeof base !== 'number') { return base; }
        var off = offsetNow();
        if (sign.y) { return base - off.y; }   /* y：屏幕向下为正，后坐力向上则减 */
        return base + off.x;
      };
    };
    wrap('getClientX', { x: 1, y: 0 });
    wrap('getScratchX', { x: 1, y: 0 });
    wrap('getClientY', { x: 0, y: 1 });
    wrap('getScratchY', { x: 0, y: 1 });
    m.__ycRecoilHooked = true;
    stats.hooked = true;
    return true;
  }

  function fire() {
    recoilT0 = Date.now();
    stats.shots++;
    hookMouse();
  }

  var heldMouse = false;
  var heldKey = false;

  /* 监听开火：左键按下/松开，以及 Q 键按下/松开（按住连发时按节奏重复触发） */
  window.addEventListener('mousedown', function (e) {
    if (e.button !== undefined && e.button !== 0) { return; }
    heldMouse = true;
    fire();
  }, true);
  window.addEventListener('mouseup', function (e) {
    if (e.button !== undefined && e.button !== 0) { return; }
    heldMouse = false;
  }, true);
  window.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'q') {
      if (!heldKey) { heldKey = true; fire(); }
    }
  }, true);
  window.addEventListener('keyup', function (e) {
    var k = (e.key || '').toLowerCase();
    if (k === 'q') { heldKey = false; }
  }, true);
  window.addEventListener('blur', function () { heldMouse = false; heldKey = false; });

  /* 按住期间的连发节奏：每一发都给一次后坐力 */
  var repeatTimer = setInterval(function () {
    if (heldMouse || heldKey) { fire(); }
  }, REPEAT);

  /* 尝试挂上鼠标钩子（虚拟机可能晚于本脚本初始化） */
  var tries = 0;
  var hookTimer = setInterval(function () {
    tries++;
    if (hookMouse() || tries > 300) { clearInterval(hookTimer); }
  }, 100);

  window.addEventListener('pagehide', function () { clearInterval(hookTimer); clearInterval(repeatTimer); });

  /* 调试接口 */
  window.__ycRecoilStats = function () { return JSON.parse(JSON.stringify(stats)); };
  window.__ycRecoilConfig = function () { return { amp: AMP, step: STEP, seq: SEQ }; };
  window.__ycRecoilFire = fire;
  window.__ycRecoilOffset = offsetNow;
})();
