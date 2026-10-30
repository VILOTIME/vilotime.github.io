/* 头像 / 图标 / 分享封面的渲染器（数据源：profile.json）
 *
 * 只给构建期用：script/sync-html.js 把它生成的 HTML 写进 index.html 的标记区间。
 * 浏览器不需要它 —— 这些都属于「页面铬件」，改完跑一次同步、刷新页面即可，
 * 没必要在运行时再渲染一遍（也没法优雅地换 favicon）。
 * 所以页面里没有 <script> 引用它，只有 Node 侧 require。
 */
'use strict';

const S = require('./sites.js');

const ALLOWED_KEYS = ['meta', 'avatar', 'icons', 'links'];
const LINK_KEYS = ['github', 'email', 'rss'];
const ICON_KEYS = ['ico', 'svg', 'png', 'appleTouch'];
/* 这几个 key 还认，但已经合并进 icons，留着只是为了给出迁移提示 */
const LEGACY_ICON_KEYS = ['favicon', 'appleTouchIcon'];
const META_KEYS = ['title', 'description', 'siteName', 'url', 'image', 'imageAlt', 'imageWidth', 'imageHeight'];

function str(value) {
  return String(value == null ? '' : value).trim();
}

/* 把 "assets/img/icon-32.png" 或 { src, sizes } 统一成对象 */
function iconEntry(value) {
  if (value == null) { return null; }
  const v = typeof value === 'object' ? value : { src: value };
  const src = str(v.src);
  if (!src) { return null; }
  return { src: src, sizes: str(v.sizes) };
}

function parse(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const rawAvatar = r.avatar && typeof r.avatar === 'object' ? r.avatar : {};
  const rawIcons = r.icons && typeof r.icons === 'object' ? r.icons : {};
  const rawLinks = r.links && typeof r.links === 'object' ? r.links : {};
  const rawMeta = r.meta && typeof r.meta === 'object' ? r.meta : {};

  const pngList = Array.isArray(rawIcons.png) ? rawIcons.png : [];
  const png = pngList.map(iconEntry).filter(Boolean);

  return {
    meta: {
      title: str(rawMeta.title),
      description: str(rawMeta.description),
      siteName: str(rawMeta.siteName),
      url: str(rawMeta.url),
      image: str(rawMeta.image),
      imageAlt: str(rawMeta.imageAlt),
      imageWidth: rawMeta.imageWidth == null ? null : Number(rawMeta.imageWidth),
      imageHeight: rawMeta.imageHeight == null ? null : Number(rawMeta.imageHeight)
    },
    avatar: {
      src: str(rawAvatar.src),
      alt: str(rawAvatar.alt),
      width: str(rawAvatar.width),
      height: str(rawAvatar.height)
    },
    /* 站点图标：ico（老浏览器 / 搜索引擎）+ svg（现代浏览器）+ png 多尺寸 + iOS 主屏 */
    icons: {
      ico: iconEntry(rawIcons.ico),
      svg: iconEntry(rawIcons.svg),
      png: png,
      appleTouch: iconEntry(rawIcons.appleTouch)
    },
    links: {
      github: str(rawLinks.github),
      /* 允许直接写 mailto:a@b.com，这里统一去掉前缀，渲染时再加回来 */
      email: str(rawLinks.email).replace(/^mailto:/i, ''),
      rss: str(rawLinks.rss)
    }
  };
}

/* 标题 / 描述 / 分享收藏卡片：<title> 和 og:* 一次生成，不会出现「标签页新名、收藏夹旧名」
 * 传进来的 m 已经把 image 解析成绝对地址（imageUrl），并带好了尺寸。 */
function metaHTML(m) {
  const lines = [];

  lines.push('<title>' + S.esc(m.title) + '</title>');
  if (m.description) {
    lines.push('<meta name="description" content="' + S.esc(m.description) + '" />');
  }

  lines.push('<meta property="og:type" content="website" />');
  if (m.siteName) {
    lines.push('<meta property="og:site_name" content="' + S.esc(m.siteName) + '" />');
  }
  lines.push('<meta property="og:title" content="' + S.esc(m.title) + '" />');
  if (m.description) {
    lines.push('<meta property="og:description" content="' + S.esc(m.description) + '" />');
  }
  if (m.url) {
    lines.push('<meta property="og:url" content="' + S.esc(m.url) + '" />');
  }
  if (m.imageUrl) {
    lines.push('<meta property="og:image" content="' + S.esc(m.imageUrl) + '" />');
    if (m.imageWidth) {
      lines.push('<meta property="og:image:width" content="' + m.imageWidth + '" />');
    }
    if (m.imageHeight) {
      lines.push('<meta property="og:image:height" content="' + m.imageHeight + '" />');
    }
    lines.push('<meta property="og:image:alt" content="' + S.esc(m.imageAlt || m.title) + '" />');
  }

  lines.push('');
  /* 方图配 summary（方形缩略图），宽图才用 summary_large_image（1.91:1 会被裁） */
  const square = m.imageWidth && m.imageHeight &&
    Math.abs(m.imageWidth - m.imageHeight) < 8;
  const card = !m.imageUrl ? 'summary' : (square ? 'summary' : 'summary_large_image');
  lines.push('<meta name="twitter:card" content="' + card + '" />');
  lines.push('<meta name="twitter:title" content="' + S.esc(m.title) + '" />');
  if (m.description) {
    lines.push('<meta name="twitter:description" content="' + S.esc(m.description) + '" />');
  }
  if (m.imageUrl) {
    lines.push('<meta name="twitter:image" content="' + S.esc(m.imageUrl) + '" />');
  }

  return lines.join('\n');
}

/* 头像：<img class="avatar__img" …>，宽高属性只用于占位不跳动，实际尺寸由 CSS 决定 */
function avatarHTML(p) {
  if (!p.avatar.src) { return ''; }
  const attrs = [
    'class="avatar__img"',
    'src="' + S.esc(p.avatar.src) + '"',
    'alt="' + S.esc(p.avatar.alt) + '"',
    'width="' + S.esc(p.avatar.width || '140') + '"',
    'height="' + S.esc(p.avatar.height || '140') + '"',
    /* 头像是首屏最显眼的一块图，给它最高优先级、别让浏览器排到后面去 */
    'fetchpriority="high"'
  ];
  return '<img ' + attrs.join(' ') + ' />';
}

/* 站点图标 + 头像预载（都在 <head> 里）
 * 顺序有讲究：.ico 放最前兜底（老浏览器和搜索引擎只认它），
 * 然后 svg（现代浏览器最清晰），最后逐尺寸 png（Google/Bing 抓缩略图会看 sizes）。 */
function iconsHTML(p) {
  const lines = [];
  const I = p.icons;

  if (I.ico) {
    /* sizes="any"：.ico 内部已经打包了多个尺寸 */
    lines.push('<link rel="icon" href="' + S.esc(I.ico.src) + '" sizes="any" />');
  }

  if (I.svg) {
    lines.push('<link rel="icon" href="' + S.esc(I.svg.src) + '" type="image/svg+xml" />');
  }

  I.png.forEach((item) => {
    const attrs = ['rel="icon"', 'href="' + S.esc(item.src) + '"', 'type="image/png"'];
    if (item.sizes) { attrs.push('sizes="' + S.esc(item.sizes) + '"'); }
    lines.push('<link ' + attrs.join(' ') + ' />');
  });

  if (I.appleTouch) {
    const attrs = ['rel="apple-touch-icon"', 'href="' + S.esc(I.appleTouch.src) + '"'];
    attrs.push('sizes="' + S.esc(I.appleTouch.sizes || '180x180') + '"');
    lines.push('<link ' + attrs.join(' ') + ' />');
  }

  /* 头像提前拉：进页面时就不会看到它从上面一行行「刷」出来 */
  if (p.avatar.src) {
    lines.push('<link rel="preload" as="image" href="' + S.esc(p.avatar.src) + '" fetchpriority="high" />');
  }

  return lines.join('\n');
}

/* 页脚链接：github / email / rss，填了哪个就出哪个，分隔点自动加 */
function linksHTML(p) {
  const order = [
    { key: 'github', label: 'GitHub' },
    { key: 'email', label: 'Email' },
    { key: 'rss', label: 'RSS' }
  ];

  const lines = [];
  let count = 0;

  order.forEach((o) => {
    const value = p.links[o.key];
    if (!value) { return; }

    const attrs = [];
    if (o.key === 'email') {
      attrs.push('href="mailto:' + S.esc(value) + '"');
      /* 本机没配邮件客户端时点 mailto 什么都不会发生，让前端顺手复制一份 */
      attrs.push('data-copy="' + S.esc(value) + '"');
    } else {
      attrs.push('href="' + S.esc(value) + '"');
      if (/^(https?:)?\/\//i.test(value)) {
        attrs.push('target="_blank"');
        attrs.push('rel="noopener noreferrer"');
      }
    }

    if (count > 0) {
      lines.push('<span class="footer__sep" aria-hidden="true">·</span>');
    }
    lines.push('<a ' + attrs.join(' ') + '>' + o.label + '</a>');
    count += 1;
  });

  return lines.join('\n');
}

/* 「联系我」按钮：邮箱没配就整个不输出 */
function contactButtonHTML(p) {
  const email = p.links.email;
  if (!email) { return ''; }

  return [
    '<a class="btn btn--ghost" href="mailto:' + S.esc(email) + '" data-copy="' + S.esc(email) + '">',
    '  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>',
    '  联系我',
    '</a>'
  ].join('\n');
}

module.exports = {
  ALLOWED_KEYS: ALLOWED_KEYS,
  LINK_KEYS: LINK_KEYS,
  ICON_KEYS: ICON_KEYS,
  LEGACY_ICON_KEYS: LEGACY_ICON_KEYS,
  META_KEYS: META_KEYS,
  parse: parse,
  metaHTML: metaHTML,
  avatarHTML: avatarHTML,
  iconsHTML: iconsHTML,
  linksHTML: linksHTML,
  contactButtonHTML: contactButtonHTML
};
