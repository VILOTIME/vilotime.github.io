/* 头像 / 网页图标的渲染器（数据源：profile.json）
 *
 * 只给构建期用：script/sync-html.js 把它生成的 HTML 写进 index.html 的标记区间。
 * 浏览器不需要它 —— 头像和 favicon 属于「页面铬件」，改完跑一次同步、刷新页面即可，
 * 没必要在运行时再渲染一遍（也没法优雅地换 favicon）。
 * 所以页面里没有 <script> 引用它，只有 Node 侧 require。
 */
'use strict';

const S = require('./sites.js');

const SCHEMA = 1;

/* 扩展名 → MIME，写扩展名就能自动推出 type，json 里不用重复填 */
const ICON_TYPES = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

const ALLOWED_KEYS = ['schema', 'meta', 'avatar', 'favicon', 'appleTouchIcon', 'links'];
const LINK_KEYS = ['github', 'email', 'rss'];
const META_KEYS = ['title', 'description', 'siteName', 'url', 'image', 'imageAlt', 'imageWidth', 'imageHeight'];

function str(value) {
  return String(value == null ? '' : value).trim();
}

function extOf(src) {
  const m = /\.[a-z0-9]+$/i.exec(String(src || '').trim());
  return m ? m[0].toLowerCase() : '';
}

function typeOf(src, override) {
  const given = String(override == null ? '' : override).trim();
  if (given) {
    return { type: given, ok: Object.keys(ICON_TYPES).some((k) => ICON_TYPES[k] === given) };
  }
  const t = ICON_TYPES[extOf(src)];
  return { type: t || '', ok: !!t };
}

function imageOf(value) {
  const v = value && typeof value === 'object' ? value : {};
  const src = String(v.src == null ? '' : v.src).trim();
  const meta = typeOf(src, v.type);
  return {
    src: src,
    exists: !!src,
    ext: extOf(src),
    type: meta.type,
    typeKnown: meta.ok,
    sizes: String(v.sizes == null ? '' : v.sizes).trim(),
    alt: String(v.alt == null ? '' : v.alt).trim(),
    width: String(v.width == null ? '' : v.width).trim(),
    height: String(v.height == null ? '' : v.height).trim()
  };
}

function parse(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const avatar = imageOf(r.avatar);
  const favicon = imageOf(r.favicon);
  const touch = r.appleTouchIcon ? imageOf(r.appleTouchIcon) : null;
  const rawLinks = r.links && typeof r.links === 'object' ? r.links : {};
  const rawMeta = r.meta && typeof r.meta === 'object' ? r.meta : {};

  return {
    schema: r.schema,
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
    avatar: avatar,
    favicon: favicon,
    appleTouchIcon: touch && touch.src ? touch : null,
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
    'height="' + S.esc(p.avatar.height || '140') + '"'
  ];
  return '<img ' + attrs.join(' ') + ' />';
}

/* 网页图标：favicon + 可选的 iOS 主屏图标 */
function iconsHTML(p) {
  const lines = [];

  if (p.favicon.src) {
    const attrs = [
      'rel="icon"',
      'href="' + S.esc(p.favicon.src) + '"',
      'type="' + S.esc(p.favicon.type) + '"'
    ];
    if (p.favicon.sizes) { attrs.push('sizes="' + S.esc(p.favicon.sizes) + '"'); }
    lines.push('<link ' + attrs.join(' ') + ' />');
  }

  if (p.appleTouchIcon) {
    lines.push('<link rel="apple-touch-icon" href="' + S.esc(p.appleTouchIcon.src) + '" />');
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
  SCHEMA: SCHEMA,
  ICON_TYPES: ICON_TYPES,
  ALLOWED_KEYS: ALLOWED_KEYS,
  LINK_KEYS: LINK_KEYS,
  META_KEYS: META_KEYS,
  extOf: extOf,
  parse: parse,
  metaHTML: metaHTML,
  avatarHTML: avatarHTML,
  iconsHTML: iconsHTML,
  linksHTML: linksHTML,
  contactButtonHTML: contactButtonHTML
};
