/* 分站点数据渲染器（唯一数据源：sites.json）
 *
 * 这一个文件同时被两边用：
 *   · 浏览器：<script src="script/sites.js"> 载入，挂到 window.SitesData，
 *             由 script/main.js 拉 sites.json 现渲染卡片。
 *   · Node：  script/sync-html.js 里 require 它，生成写进 index.html 的静态兜底。
 * 两边共用同一套模板，所以「脚本生成的」和「浏览器渲染的」永远长得一样。
 *
 * 一份分站点只写这些字段：
 *     id  title  desc  href  icon  color  tag  sameTab
 * 除 id 之外全部可省；tint、是否新窗口打开等都由这里算出来。
 *
 * 跳转方式：
 *   · 相对路径（如 "blogs/"）      → 同页跳转（天然同站）
 *   · 绝对地址（如 "https://…"）  → 默认新标签页打开
 *   · 想让绝对地址也同页跳转          → 加 "sameTab": true
 */
(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (global) {
    global.SitesData = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_COLOR = '#7b93ff';

  /* 卡片图标库：json 里的 icon 只写 key，具体路径在这里维护。
     想加图标就往这里加一条，然后在 sites.json 里用 key 引用。 */
  var ICONS = {
    blog: '<path d="M4 5.5h16M4 12h16M4 18.5h10" />',
    notes: '<path d="M5 4.5h9.5L19 9v10.5H5z" /><path d="M14 4.5V9h5" /><path d="M8.5 13h7M8.5 16.5h4.5" />',
    works: '<rect x="3.5" y="4.5" width="17" height="12" rx="2.5" /><path d="M8 20h8M12 16.5V20" />',
    tools: '<path d="m14.5 5.5 4 4-8.5 8.5H6v-4z" /><path d="M4 20.5h16" />',
    gallery: '<rect x="3.5" y="5.5" width="17" height="13" rx="3" /><circle cx="9" cy="11" r="1.8" /><path d="m5 17 4.5-4 3 2.5L16 12l3 3.5" />',
    about: '<circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />',
    link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7l-1.3 1.3" /><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.3-1.3" />'
  };

  var ARROW = '<svg class="site__arrow icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* "#6d8cff" -> "109 140 255"（CSS 里 --tint 需要空格分隔的 RGB 分量） */
  function hexToTint(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) { return null; }
    var h = m[1];
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16); }).join(' ');
  }

  function isExternal(href) {
    return /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href);
  }

  function normalize(entry) {
    var s = entry || {};
    var id = String(s.id == null ? '' : s.id).trim();
    var href = String(s.href == null ? '' : s.href).trim();
    var iconKey = String(s.icon == null ? '' : s.icon).trim();
    var absolute = isExternal(href);

    return {
      id: id,
      title: String(s.title == null ? '' : s.title).trim() || id,
      desc: String(s.desc == null ? '' : s.desc).trim(),
      href: href,
      /* 没填链接 -> 渲染成占位卡片，点一下只弹提示，不会跳到 404 */
      placeholder: !href || href === '#',
      icon: ICONS[iconKey] ? iconKey : 'link',
      knownIcon: !!ICONS[iconKey],
      tint: hexToTint(s.color) || hexToTint(DEFAULT_COLOR),
      plainColor: /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s.color || '').trim()),
      tag: String(s.tag == null ? '' : s.tag).trim() || id,
      external: absolute,
      /* 同页跳转：显式 sameTab: true，或者链接本身就是相对路径（相对路径天然是同站） */
      sameTab: !absolute || s.sameTab === true,
      /* 渲染时到底加不加 target="_blank" */
      blank: absolute && s.sameTab !== true
    };
  }

  function parse(raw) {
    var r = raw || {};
    var list = Array.isArray(r.sites) ? r.sites : [];
    var sites = list.map(normalize);
    return {
      title: String(r.title == null ? '' : r.title).trim() || '分站点',
      sites: sites,
      total: sites.length
    };
  }

  function cardHTML(site) {
    var attrs = ['class="site reveal"', 'href="' + esc(site.placeholder ? '#' : site.href) + '"'];
    if (site.placeholder) {
      attrs.push('data-site');
    } else if (site.blank) {
      attrs.push('target="_blank"');
      attrs.push('rel="noopener noreferrer"');
    }

    var lines = [];
    lines.push('<a ' + attrs.join(' ') + '>');
    lines.push('  <span class="site__icon" style="--tint: ' + site.tint + '">');
    lines.push('    <svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[site.icon] + '</svg>');
    lines.push('  </span>');
    lines.push('  <span class="site__body">');
    lines.push('    <span class="site__title">' + esc(site.title) + '</span>');
    if (site.desc) {
      lines.push('    <span class="site__desc">' + esc(site.desc) + '</span>');
    }
    lines.push('  </span>');
    if (site.tag) {
      lines.push('  <span class="site__tag">' + esc(site.tag) + '</span>');
    }
    lines.push('  ' + ARROW);
    lines.push('</a>');
    return lines.join('\n');
  }

  function gridHTML(ds) {
    return ds.sites.map(cardHTML).join('\n');
  }

  return {
    DEFAULT_COLOR: DEFAULT_COLOR,
    ICONS: ICONS,
    ICON_KEYS: Object.keys(ICONS),
    ARROW: ARROW,
    esc: esc,
    hexToTint: hexToTint,
    isExternal: isExternal,
    normalize: normalize,
    parse: parse,
    cardHTML: cardHTML,
    gridHTML: gridHTML
  };
});
