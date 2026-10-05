/* 悬浮方向键 —— 对应键盘 W / A / S / D，方便触屏设备操作
 *
 * 用法：在游戏页面末尾加一行即可（放在 </html> 之后也能生效）：
 *     <script src="pad.js"></script>
 *
 * 说明：按键事件是直接派发到本页面 document 上的，和真实键盘完全一致
 * （key / code / keyCode / which 都补齐），游戏里的
 * document.addEventListener('keydown', ...) 就能收到。
 * 因为不涉及跨 iframe 访问，所以本地用 file:// 直接打开也能用。
 */
(function () {
  'use strict';

  if (window.__ycPadLoaded) { return; }
  window.__ycPadLoaded = true;

  var STORE_KEY = 'yc-pad-v2';
  /* 轻点也保证按住这么久，避免游戏还没采样到就松开了 */
  var MIN_HOLD = 160;

  var KEYS = [
    { cls: 'up', key: 'w', code: 'KeyW', keyCode: 87, label: 'W', name: '上' },
    { cls: 'left', key: 'a', code: 'KeyA', keyCode: 65, label: 'A', name: '左' },
    { cls: 'down', key: 's', code: 'KeyS', keyCode: 83, label: 'S', name: '下' },
    { cls: 'right', key: 'd', code: 'KeyD', keyCode: 68, label: 'D', name: '右' },
    { cls: 'space', key: ' ', code: 'Space', keyCode: 32, label: 'SPACE', name: '空格' }
  ];

  var CSS = [
    '.yc-pad{--yc-pad-size:56px;--yc-pad-space-h:44px;--yc-pad-letter:22px;position:fixed;left:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-start;gap:8px;font-family:inherit;line-height:1;pointer-events:none}',
    '.yc-pad-keys{display:grid;grid-template-columns:repeat(3,var(--yc-pad-size));grid-template-rows:var(--yc-pad-size) var(--yc-pad-size) var(--yc-pad-space-h);gap:6px}',
    '.yc-pad-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:var(--yc-pad-size);height:var(--yc-pad-size);padding:0;color:#fff;background:rgba(24,32,44,.72);border:1px solid rgba(255,255,255,.3);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;pointer-events:auto;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;transition:background-color .12s ease,transform .12s ease,border-color .12s ease}',
    '.yc-pad-btn.is-down{background:#4f9cf9;border-color:#4f9cf9;transform:scale(.94)}',
    '.yc-pad-key{font-size:var(--yc-pad-letter);font-weight:700;opacity:.95;letter-spacing:.5px}',
    '.yc-pad-up{grid-column:2;grid-row:1}',
    '.yc-pad-left{grid-column:1;grid-row:2}',
    '.yc-pad-down{grid-column:2;grid-row:2}',
    '.yc-pad-right{grid-column:3;grid-row:2}',
    '.yc-pad-space{grid-column:1 / span 3;grid-row:3;width:auto;height:var(--yc-pad-space-h);flex-direction:row;gap:6px}',
    '.yc-pad-toggle{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;font-family:inherit;font-size:12px;line-height:1;color:#fff;background:rgba(24,32,44,.72);border:1px solid rgba(255,255,255,.3);border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-touch-callout:none}',
    '.yc-pad-toggle:hover{border-color:#4f9cf9}',
    '.yc-pad.is-collapsed .yc-pad-keys{display:none}',
    '@media (max-width:768px){.yc-pad{left:12px;bottom:12px;--yc-pad-size:58px;--yc-pad-space-h:46px;--yc-pad-letter:26px}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  var pad = document.createElement('div');
  pad.className = 'yc-pad';

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'yc-pad-toggle';
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('title', '显示 / 收起虚拟按键（W / A / S / D / SPACE）');
  var toggleIcon = document.createElement('span');
  toggleIcon.setAttribute('aria-hidden', 'true');
  toggleIcon.textContent = '🎮';
  var toggleText = document.createElement('span');
  toggleText.className = 'yc-pad-text';
  toggleText.textContent = '收起';
  toggle.appendChild(toggleIcon);
  toggle.appendChild(toggleText);

  var keysBox = document.createElement('div');
  keysBox.className = 'yc-pad-keys';

  /* ---------- 造一个和真实键盘一致的按键事件，直接派发给本页面 ---------- */
  function fire(type, spec) {
    var ev = null;
    var init = {
      key: spec.key,
      code: spec.code,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };
    try { ev = new KeyboardEvent(type, init); } catch (e) { ev = null; }
    if (!ev) {
      try {
        ev = document.createEvent('KeyboardEvent');
        ev.initKeyboardEvent(type, true, true, window, spec.key, 0, '', false);
      } catch (e2) { return; }
    }
    /* keyCode / which 没法通过构造参数写入，这里补上（老代码会读它） */
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return spec.keyCode; } }); } catch (e3) {}
    try { Object.defineProperty(ev, 'which', { get: function () { return spec.keyCode; } }); } catch (e4) {}
    try { document.dispatchEvent(ev); } catch (e5) {}
  }

  var isDown = {};
  var timers = {};
  var buttons = {};

  /* 用户的显式选择：null = 没选过（按设备自动判断），'1' = 展开，'0' = 收起 */
  var userChoice = null;
  (function () {
    var saved = null;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (saved === '0' || saved === '1') { userChoice = saved; }
  })();
  function remember(value) {
    userChoice = value;
    try { localStorage.setItem(STORE_KEY, value); } catch (e) {}
  }

  function press(spec) {
    if (isDown[spec.code]) { return; }
    if (timers[spec.code]) { clearTimeout(timers[spec.code]); delete timers[spec.code]; }
    isDown[spec.code] = Date.now();
    if (buttons[spec.code]) { buttons[spec.code].classList.add('is-down'); }
    fire('keydown', spec);
  }

  function release(spec) {
    if (!isDown[spec.code]) { return; }
    var held = Date.now() - isDown[spec.code];
    delete isDown[spec.code];
    if (buttons[spec.code]) { buttons[spec.code].classList.remove('is-down'); }
    var wait = MIN_HOLD - held;
    if (wait > 0) {
      timers[spec.code] = setTimeout(function () {
        delete timers[spec.code];
        fire('keyup', spec);
      }, wait);
    } else {
      fire('keyup', spec);
    }
  }

  function releaseAll() {
    Object.keys(timers).forEach(function (code) {
      clearTimeout(timers[code]);
      delete timers[code];
    });
    KEYS.forEach(function (spec) {
      if (isDown[spec.code]) {
        delete isDown[spec.code];
        fire('keyup', spec);
      }
      if (buttons[spec.code]) { buttons[spec.code].classList.remove('is-down'); }
    });
  }

  KEYS.forEach(function (spec) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'yc-pad-btn yc-pad-' + spec.cls;
    btn.setAttribute('aria-label', spec.name + '（' + spec.label + '）');
    var label = document.createElement('span');
    label.className = 'yc-pad-key';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = spec.label;
    btn.appendChild(label);
    buttons[spec.code] = btn;

    var held = false;

    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      }
      held = true;
      press(spec);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
      btn.addEventListener(type, function () {
        if (!held) { return; }
        held = false;
        release(spec);
      });
    });
    /* 长按不要弹出系统菜单 */
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* 没有指针事件的旧环境：鼠标 / 触摸兜底 */
    if (!window.PointerEvent) {
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); held = true; press(spec); });
      btn.addEventListener('mouseup', function () { if (held) { held = false; release(spec); } });
      btn.addEventListener('mouseleave', function () { if (held) { held = false; release(spec); } });
      btn.addEventListener('touchstart', function (e) { e.preventDefault(); held = true; press(spec); }, { passive: false });
      btn.addEventListener('touchend', function (e) { e.preventDefault(); if (held) { held = false; release(spec); } }, { passive: false });
      btn.addEventListener('touchcancel', function () { if (held) { held = false; release(spec); } });
    }

    keysBox.appendChild(btn);
  });

  /* ---------- 显示 / 收回 ---------- */
  function setCollapsed(collapsed, rememberIt) {
    pad.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleText.textContent = collapsed ? '按键' : '收起';
    toggle.setAttribute('title', collapsed ? '显示虚拟按键（W / A / S / D / SPACE）' : '收起虚拟按键');
    if (collapsed) { releaseAll(); }
    if (rememberIt) { remember(collapsed ? '0' : '1'); }
  }

  /* 这台设备是不是“没有实体键盘”的设备（手机 / 平板）。
     判断偏保守：不确定就当成“有键盘”，默认收起，用户点一下 🎮 就能展开。 */
  function isTouchOnlyDevice() {
    try {
      var touchPoints = navigator.maxTouchPoints || 0;
      if (touchPoints === 0) { return false; }   /* 完全没有触摸 → 一定是电脑 */
      var ua = navigator.userAgent || '';
      var mobileUA = /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle/i.test(ua);
      if (window.matchMedia) {
        var coarse = window.matchMedia('(pointer: coarse)').matches;
        var noHover = window.matchMedia('(hover: none)').matches;
        /* 主指针是手指、不能悬停：手机 / 平板 */
        if (coarse && noHover) { return true; }
        /* 有鼠标（能悬停）的触屏电脑，按“有键盘”处理 */
        if (!noHover) { return false; }
      }
      return mobileUA;
    } catch (e) { return false; }
  }

  /* 初始状态：没手动选过就按设备判断——没有键盘默认展开，有键盘默认收起 */
  if (!userChoice) {
    setCollapsed(!isTouchOnlyDevice(), false);
  } else {
    setCollapsed(userChoice === '0', false);
  }

  toggle.addEventListener('click', function () {
    setCollapsed(!pad.classList.contains('is-collapsed'), true);
  });

  pad.appendChild(toggle);
  pad.appendChild(keysBox);
  (document.body || document.documentElement).appendChild(pad);

  /* 触屏冲突：游戏在 document 上监听 mousemove / mouseup / touchmove / touchend，
     按在悬浮键上的手指会被它当成瞄准或点击，所以这里把事件拦在悬浮键内部，不再往上冒泡。 */
  [
    'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
    'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick',
    'touchstart', 'touchmove', 'touchend', 'touchcancel', 'contextmenu'
  ].forEach(function (type) {
    pad.addEventListener(type, function (e) { e.stopPropagation(); }, { passive: false });
  });

  /* 真的按到实体键盘（isTrusted，排除虚拟键自己派发的事件）→ 判断这台设备有键盘，自动收起并记住 */
  document.addEventListener('keydown', function (e) {
    if (!e.isTrusted || userChoice) { return; }
    setCollapsed(true, true);
  }, true);

  /* 免得松手时按键卡住 */
  window.addEventListener('blur', releaseAll);
  window.addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { releaseAll(); }
  });

  /* 方便调试 / 让别的页面驱动：__ycPad.press('KeyW') */
  window.__ycPad = {
    keys: KEYS,
    press: function (code) {
      var spec = null;
      KEYS.forEach(function (k) { if (k.code === code) { spec = k; } });
      if (spec) { press(spec); }
    },
    release: function (code) {
      var spec = null;
      KEYS.forEach(function (k) { if (k.code === code) { spec = k; } });
      if (spec) { release(spec); }
    },
    releaseAll: releaseAll,
    isCollapsed: function () { return pad.classList.contains('is-collapsed'); },
    setCollapsed: setCollapsed,
    element: pad
  };
})();
