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

  var STORE_KEY = 'yc-pad';
  /* 轻点也保证按住这么久，避免游戏还没采样到就松开了 */
  var MIN_HOLD = 160;

  var KEYS = [
    { cls: 'up', key: 'w', code: 'KeyW', keyCode: 87, arrow: '▲', label: 'W', name: '上' },
    { cls: 'left', key: 'a', code: 'KeyA', keyCode: 65, arrow: '◀', label: 'A', name: '左' },
    { cls: 'down', key: 's', code: 'KeyS', keyCode: 83, arrow: '▼', label: 'S', name: '下' },
    { cls: 'right', key: 'd', code: 'KeyD', keyCode: 68, arrow: '▶', label: 'D', name: '右' },
    { cls: 'space', key: ' ', code: 'Space', keyCode: 32, arrow: '', label: '空格', name: '空格' }
  ];

  var CSS = [
    '.yc-pad{--yc-pad-size:56px;--yc-pad-space-h:44px;position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-family:inherit;line-height:1}',
    '.yc-pad-keys{display:grid;grid-template-columns:repeat(3,var(--yc-pad-size));grid-template-rows:var(--yc-pad-size) var(--yc-pad-size) var(--yc-pad-space-h);gap:6px}',
    '.yc-pad-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:var(--yc-pad-size);height:var(--yc-pad-size);padding:0;color:#fff;background:rgba(24,32,44,.72);border:1px solid rgba(255,255,255,.3);border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;-webkit-tap-highlight-color:transparent;transition:background-color .12s ease,transform .12s ease,border-color .12s ease}',
    '.yc-pad-btn.is-down{background:#4f9cf9;border-color:#4f9cf9;transform:scale(.94)}',
    '.yc-pad-arrow{font-size:15px}',
    '.yc-pad-key{font-size:10px;opacity:.7}',
    '.yc-pad-up{grid-column:2;grid-row:1}',
    '.yc-pad-left{grid-column:1;grid-row:2}',
    '.yc-pad-down{grid-column:2;grid-row:2}',
    '.yc-pad-right{grid-column:3;grid-row:2}',
    '.yc-pad-space{grid-column:1 / span 3;grid-row:3;width:auto;height:var(--yc-pad-space-h);flex-direction:row;gap:6px}',
    '.yc-pad-space .yc-pad-key{font-size:11px;opacity:.85}',
    '.yc-pad-toggle{display:inline-flex;align-items:center;gap:5px;padding:7px 12px;font-family:inherit;font-size:12px;line-height:1;color:#fff;background:rgba(24,32,44,.72);border:1px solid rgba(255,255,255,.3);border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.3);cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}',
    '.yc-pad-toggle:hover{border-color:#4f9cf9}',
    '.yc-pad.is-collapsed .yc-pad-keys{display:none}',
    '@media (max-width:768px){.yc-pad{right:12px;bottom:12px;--yc-pad-size:58px;--yc-pad-space-h:46px}}'
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
  toggle.setAttribute('title', '显示 / 收起虚拟按键（W / A / S / D / 空格）');
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
    var arrow = document.createElement('span');
    arrow.className = 'yc-pad-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = spec.arrow;
    var label = document.createElement('span');
    label.className = 'yc-pad-key';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = spec.label;
    if (spec.arrow) { btn.appendChild(arrow); }
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
  function setCollapsed(collapsed) {
    pad.classList.toggle('is-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggleText.textContent = collapsed ? '按键' : '收起';
    toggle.setAttribute('title', collapsed ? '显示虚拟按键（W / A / S / D / 空格）' : '收起虚拟按键');
    if (collapsed) { releaseAll(); }
    try { localStorage.setItem(STORE_KEY, collapsed ? '0' : '1'); } catch (e) {}
  }

  toggle.addEventListener('click', function () {
    setCollapsed(!pad.classList.contains('is-collapsed'));
  });

  pad.appendChild(toggle);
  pad.appendChild(keysBox);
  (document.body || document.documentElement).appendChild(pad);

  var saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
  if (saved === '0') { setCollapsed(true); }

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
