/**
 * Vilotime · 个人主页脚本
 *
 * 1) 深色 / 浅色主题切换（记忆到 localStorage，首次跟随系统）
 * 2) 分站点卡片：走 http 时从 sites.json 现渲染；file:// / 断网 / 禁 JS 时用
 *    index.html 里由 script/sync-html.js 生成的静态兜底
 * 3) 滚动入场动效（动态插入的卡片也会被重新观察）
 * 4) 还没配链接的卡片，点一下给友好提示
 * 5) 点邮箱时顺手复制地址（本机没配邮件客户端也不至于毫无反应）
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'vilotime-theme';

  function toArray(list) {
    return Array.prototype.slice.call(list || []);
  }

  /* ---------- 主题 ---------- */
  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* 隐私模式忽略 */ }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* 忽略 */ }

    if (saved === 'dark' || saved === 'light') {
      root.setAttribute('data-theme', saved);
      return;
    }
    // 没有保存过：跟随系统偏好
    var prefersLight = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    root.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
  }

  initTheme();

  var toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
    });
  }

  /* ---------- 头像：等下载完再显示 ----------
   * 网速慢的时候，浏览器会把 JPEG 边收边画，看起来像「一点点加载」。
   * 所以 HTML 里给 .avatar 预置了 avatar--pending（图片 opacity: 0，只露占位圆），
   * 这里等图片真正下载完再去掉这个类，让它整体淡入；已缓存的直接显示。 */
  (function revealAvatar() {
    var img = document.querySelector('.avatar__img');
    var box = img && img.closest ? img.closest('.avatar') : null;
    if (!img || !box) { return; }

    function show() { box.classList.remove('avatar--pending'); }

    // 已经下载完（缓存命中）：直接显示，不用等
    if (img.complete && img.naturalWidth > 0) { show(); return; }

    img.addEventListener('load', show);
    // 加载失败也别一直空着，露出 alt 让用户知道发生了什么
    img.addEventListener('error', show);
  })();

  /* ---------- 滚动入场 ---------- */
  var observeReveals = (function () {
    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 没有观察器 / 用户要求减少动效：直接显示，别把内容锁住
    if (reduceMotion || !('IntersectionObserver' in window)) {
      return function (nodes) {
        toArray(nodes).forEach(function (el) { el.classList.add('is-visible'); });
      };
    }

    var delivered = false;
    var io = new IntersectionObserver(function (entries) {
      delivered = true;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        // 同一批元素做一点点错峰，观感更自然
        var delay = Number(entry.target.dataset.revealDelay || 0);
        setTimeout(function () {
          entry.target.classList.add('is-visible');
        }, delay);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    // 保险：万一观察器一次都没回调（个别环境 / 内嵌浏览器），也不要把内容锁在不可见状态
    setTimeout(function () {
      if (delivered) { return; }
      toArray(document.querySelectorAll('.reveal')).forEach(function (el) {
        el.classList.add('is-visible');
      });
    }, 1600);

    return function (nodes) {
      toArray(nodes).forEach(function (el, i) {
        el.dataset.revealDelay = String(Math.min(i * 55, 260));
        io.observe(el);
      });
    };
  })();

  observeReveals(document.querySelectorAll('.reveal'));

  /* ---------- 分站点卡片：sites.json 现渲染 ---------- */
  /* 判断「DOM 里的卡片是不是已经等于 json 里的数据」。
     不能直接比 HTML 字符串：浏览器序列化 SVG 时会把 <path /> 展开成 <path></path>，
     再加上运行时插入的 is-visible / data-reveal-delay，字符串永远对不上。
     所以这里比的是每张卡片的实际内容。 */
  function cardsMatchDom(grid, sites) {
    var nodes = grid.querySelectorAll('.site');
    if (nodes.length !== sites.length) { return false; }

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var s = sites[i];
      var title = el.querySelector('.site__title');
      var desc = el.querySelector('.site__desc');
      var tag = el.querySelector('.site__tag');
      var icon = el.querySelector('.site__icon');

      if (!title || title.textContent.trim() !== s.title) { return false; }
      if ((desc ? desc.textContent.trim() : '') !== (s.desc || '')) { return false; }
      if ((tag ? tag.textContent.trim() : '') !== (s.tag || '')) { return false; }
      if ((el.getAttribute('href') || '') !== (s.placeholder ? '#' : s.href)) { return false; }
      if (el.hasAttribute('data-site') !== !!s.placeholder) { return false; }
      /* 跳转方式也算内容的一部分：改了 sameTab 也要能反映出来 */
      if ((el.getAttribute('target') || '') !== (s.blank ? '_blank' : '')) { return false; }
      if (icon && (icon.getAttribute('style') || '').indexOf(s.tint) < 0) { return false; }
    }
    return true;
  }

  function renderSitesFromJson() {
    var api = window.SitesData;
    var grid = document.getElementById('siteGrid');
    if (!api || !grid || typeof fetch !== 'function') { return; }

    /* 双击 index.html（file://）时浏览器禁止 fetch 本地文件：
       控制台会甩出「blocked by CORS policy」和「ERR_FAILED」两条报错，
       而这时候本来也只能用页面里已经生成好的卡片。所以提前判断协议，不发这个注定失败的请求。 */
    var scheme = location.protocol;
    if (scheme !== 'http:' && scheme !== 'https:') {
      console.info('[主页] 当前以 ' + scheme + ' 打开，跳过 sites.json 实时渲染，' +
        '直接用页面内已生成的卡片。想看 json 实时生效，用 node script/dev.js 起本地预览。');
      return;
    }

    fetch('sites.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) { throw new Error('HTTP ' + res.status); }
        return res.json();
      })
      .then(function (raw) {
        var ds = api.parse(raw);
        if (!ds.total) { return; }

        /* 静态兜底已经和 json 一致时，一个字都别动。
           换掉 innerHTML 会让卡片以全新节点从透明重新淡入一次，
           叠上页面初次加载的入场动画，看起来就是「动画播了两遍」。 */
        if (cardsMatchDom(grid, ds.sites)) { return; }

        var hadCards = grid.querySelectorAll('.site').length > 0;
        grid.innerHTML = api.gridHTML(ds);

        var added = grid.querySelectorAll('.reveal');
        if (hadCards) {
          /* 卡片已经在屏幕上了，只是内容变了：直接显示，不再补一次入场动画 */
          toArray(added).forEach(function (el) { el.classList.add('is-visible'); });
        } else {
          observeReveals(added);
        }
      })
      .catch(function () {
        /* file:// 直开（CORS）、断网、json 写坏了：都保留 index.html 里的静态兜底 */
      });
  }

  renderSitesFromJson();

  /* ---------- 占位链接提示 ---------- */
  var noticeTimer = null;

  function flashNotice(message) {
    var box = document.getElementById('demoNotice');
    if (!box) {
      box = document.createElement('div');
      box.id = 'demoNotice';
      box.setAttribute('role', 'status');
      box.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:26px',
        'transform:translate(-50%,18px)',
        'max-width:min(92vw,420px)',
        'padding:11px 18px',
        'border-radius:14px',
        'font-size:0.86rem',
        'line-height:1.55',
        'text-align:center',
        'color:var(--text)',
        'background:var(--surface-hover)',
        'border:1px solid var(--border-strong)',
        'box-shadow:var(--shadow-lift)',
        'backdrop-filter:blur(16px)',
        '-webkit-backdrop-filter:blur(16px)',
        'opacity:0',
        'pointer-events:none',
        'z-index:50',
        'transition:opacity .3s ease, transform .3s ease'
      ].join(';');
      document.body.appendChild(box);
    }
    box.textContent = message;
    // 强制回流后再上浮，保证过渡生效
    void box.offsetWidth;
    box.style.opacity = '1';
    box.style.transform = 'translate(-50%, 0)';

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () {
      box.style.opacity = '0';
      box.style.transform = 'translate(-50%, 18px)';
    }, 2600);
  }

  /* 用事件委托：卡片是 json 渲染出来的，绑不上匿名节点 */
  document.addEventListener('click', function (event) {
    var target = event.target;
    var link = target && target.closest ? target.closest('a[data-site]') : null;
    if (!link) { return; }

    event.preventDefault();
    var titleEl = link.querySelector('.site__title');
    var label = (titleEl && titleEl.textContent.trim()) || link.textContent.trim();
    flashNotice('「' + label + '」还没有配置链接，在 sites.json 里填上 href 再跑一次同步即可。');
  });

  /* ---------- 邮箱点击兜底 ----------
   * mailto: 要靠系统里配了邮件客户端才会弹出窗口，没配的话点了「毫无反应」。
   * 所以带 data-copy 的链接被点时会顺手把地址复制到剪贴板，并提示一下。
   * 注意不 preventDefault：装了客户端的用户照样能直接打开写信窗口。 */
  function copyText(text) {
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, text.length);
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) {
        return false;
      }
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(legacy);
    }
    return Promise.resolve(legacy());
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    var el = target && target.closest ? target.closest('[data-copy]') : null;
    if (!el) { return; }

    var value = el.getAttribute('data-copy');
    if (!value) { return; }

    copyText(value).then(function (ok) {
      flashNotice(ok ? '已复制：' + value : '邮箱：' + value);
    });
  });
})();
