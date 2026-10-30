/* 数据 → index.html 同步（旧名 export-sites.js，现在同时管头像和网页图标）
 *
 * 用法：
 *   node script/sync-html.js          校验 + 把标记区间重写成 json 的内容
 *   node script/sync-html.js --check  只检查，不写文件
 *
 * 同步策略（和以前「一个 json 对一个区间」不同了）：
 *   每个数据文件负责几个标记区间，统一在下面的 REGIONS 表里声明，
 *   加一类新数据只要在表里加一行，不用改流程代码。
 *
 *     sites.json   ──► <!-- sites:start --> … <!-- sites:end -->         分站点卡片
 *     profile.json ──► <!-- profile:avatar:start --> … :end -->          头像
 *                  └─► <!-- profile:icons:start --> … :end -->           网页图标
 *
 *   为什么这两类数据的处理方式不一样：
 *     · 卡片：浏览器会用 fetch 拉 sites.json 现渲染（http 下改 json 刷新即生效），
 *       HTML 里这份只是 file:// / 断网 / 禁 JS 时的兜底。
 *     · 头像和图标：属于「页面铬件」，运行时重渲染没意义（favicon 也换不优雅），
 *       所以只在构建期同步进 HTML，改完跑一次本脚本即可。
 *
 * 校验会检查引用的图片文件是否真的存在，路径写错会直接报错，不会静默失效。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const S = require(path.join(__dirname, 'sites.js'));
const P = require(path.join(__dirname, 'profile.js'));

const TARGET = 'index.html';
const CHECK_ONLY = process.argv.indexOf('--check') >= 0;

const SITE_KEYS = ['id', 'title', 'desc', 'href', 'icon', 'color', 'tag', 'sameTab'];

const warnings = [];
const errors = [];
const warn = (msg) => warnings.push(msg);
const fail = (msg) => errors.push(msg);

/* ---------------- 读取数据 ---------------- */
function readJson(name) {
  const abs = path.join(root, name);
  if (!fs.existsSync(abs)) {
    console.error('✖ 找不到 ' + name + '：' + abs);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    console.error('✖ ' + name + ' 不是合法 JSON：' + e.message);
    process.exit(1);
  }
}

const rawSites = readJson('sites.json');
const rawProfile = readJson('profile.json');

const ds = S.parse(rawSites);
const pp = P.parse(rawProfile);

/* ---------------- 校验：分站点 ---------------- */
if (rawSites.schema !== S.SCHEMA) {
  warn('sites.json：schema 应为 ' + S.SCHEMA + '，当前是 ' + JSON.stringify(rawSites.schema));
}
if (!Array.isArray(rawSites.sites)) {
  fail('sites.json：顶层缺少 sites 数组');
}
if (!ds.total) {
  fail('sites.json：sites 是空的，至少要有一个分站点');
}

const seenIds = {};
const seenTitles = {};

(rawSites.sites || []).forEach((entry, i) => {
  const at = 'sites[' + i + ']';
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail(at + ' 不是一个对象');
    return;
  }

  const s = S.normalize(entry);

  if (!s.id) {
    fail(at + '：缺少 id（唯一标识，例如 "blog"）');
  } else if (seenIds[s.id]) {
    fail('id 重复：' + s.id + '（' + at + '）');
  } else {
    seenIds[s.id] = 1;
  }

  if (!entry.title) {
    warn((s.id || at) + '：缺少 title，卡片标题会退回 id');
  }
  if (!s.desc) {
    warn((s.id || at) + '：缺少 desc（卡片副标题，会显得很空）');
  }
  if (s.placeholder) {
    warn((s.id || at) + '：href 还是空的，点击会弹「还没配置链接」的提示，不是真的跳转');
  } else if (/^[\\/]{2}/.test(s.href)) {
    warn((s.id || at) + '：href 别用 // 开头（' + s.href + '）');
  }
  if (!entry.icon) {
    warn((s.id || at) + '：没写 icon，会用默认的回形针图标（可选：' + S.ICON_KEYS.join(' / ') + '）');
  } else if (!s.knownIcon) {
    warn((s.id || at) + '：icon "' + entry.icon + '" 不在图标库里，已退回默认图标（可选：' + S.ICON_KEYS.join(' / ') + '）');
  }
  if (!entry.color) {
    warn((s.id || at) + '：没写 color，图标会用默认蓝色');
  } else if (!s.plainColor) {
    warn((s.id || at) + '：color 不是合法 hex（' + JSON.stringify(entry.color) + '），应形如 "#6d8cff"');
  }
  if ('sameTab' in entry && typeof entry.sameTab !== 'boolean') {
    warn((s.id || at) + '：sameTab 应为 true / false（true = 同页跳转，不开新标签）');
  }
  if (s.blank && !entry.sameTab) {
    /* 绝对地址默认开新标签；如果它其实就是本站链接，加 sameTab 更顺手 */
    const siteRoot = String(pp.meta.url || '').replace(/\/+$/, '');
    if (siteRoot && s.href.indexOf(siteRoot) === 0) {
      warn((s.id || at) + '：指向本站自己的地址（' + s.href + '），想同页跳转就把 href 换成相对路径或加 "sameTab": true');
    }
  }

  const titleKey = s.title.toLowerCase();
  if (s.title && seenTitles[titleKey]) {
    warn((s.id || at) + '：title 「' + s.title + '」和前面的卡片重名了');
  }
  seenTitles[titleKey] = 1;

  Object.keys(entry).forEach((k) => {
    if (SITE_KEYS.indexOf(k) < 0) {
      warn((s.id || at) + '：多了个没用到的字段 "' + k + '"（只认 ' + SITE_KEYS.join(' / ') + '）');
    }
  });
});

/* ---------------- 校验：标题 / 描述 / 分享卡片 ---------------- */
const M = pp.meta;
const isAbsolute = (u) => /^https?:\/\//i.test(u);

/* 相对路径补成绝对地址：微信不会去猜相对路径，所以 base 不合法时宁可返回空（不输出 og:image） */
function absoluteUrl(base, rel) {
  if (isAbsolute(rel)) { return rel; }
  if (!isAbsolute(base)) { return ''; }
  return base.replace(/\/+$/, '') + '/' + String(rel).replace(/^\/+/, '');
}

/* 直接读 PNG 的 IHDR 拿真实宽高，省得换图后写成旧数字 */
function pngSize(absFile) {
  try {
    const buf = fs.readFileSync(absFile);
    const isPng = buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    if (!isPng) { return null; }
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch (e) {
    return null;
  }
}

if (!M.title) {
  fail('profile.json → meta.title：必填，否则网页没有标题、收藏夹会显示地址');
}
if (!M.description) {
  warn('profile.json → meta.description：没写，分享卡片会没有描述');
}
if (!M.url) {
  warn('profile.json → meta.url：没写站点地址，og:url 和封面的绝对地址都生成不了');
} else if (!isAbsolute(M.url)) {
  warn('profile.json → meta.url：要是完整地址（https://…），当前是 ' + M.url);
  if (!/\/$/.test(M.url)) { warn('profile.json → meta.url：建议以 / 结尾（' + M.url + '）'); }
}

/* 封面：本地路径检查存在性，绝对地址则跳过 */
let imageUrl = '';
let imageWidth = Number.isFinite(M.imageWidth) ? M.imageWidth : null;
let imageHeight = Number.isFinite(M.imageHeight) ? M.imageHeight : null;

if (!M.image) {
  warn('profile.json → meta.image：没写封面，微信收藏 / 分享不会显示缩略图');
} else if (isAbsolute(M.image)) {
  imageUrl = M.image;
} else {
  const local = path.join(root, M.image);
  if (!fs.existsSync(local)) {
    fail('profile.json → meta.image：文件 ' + M.image + ' 不存在');
  } else {
    const size = /\.png$/i.test(M.image) ? pngSize(local) : null;
    if (size) {
      imageWidth = size.width;
      imageHeight = size.height;
      if (Number.isFinite(M.imageWidth) && M.imageWidth !== size.width) {
        warn('profile.json → meta.imageWidth：写的是 ' + M.imageWidth + '，但图片实际是 ' + size.width + '（已按实际值输出）');
      }
      if (Number.isFinite(M.imageHeight) && M.imageHeight !== size.height) {
        warn('profile.json → meta.imageHeight：写的是 ' + M.imageHeight + '，但图片实际是 ' + size.height + '（已按实际值输出）');
      }
    } else if (!imageWidth || !imageHeight) {
      warn('profile.json → meta.image：读不出图片尺寸（非 PNG 又没写 imageWidth/imageHeight），封面尺寸标签会省略');
    }
  }
  imageUrl = absoluteUrl(M.url, M.image);
  if (M.image && !imageUrl) {
    warn('profile.json → meta.image：meta.url 不是完整地址，拼不出绝对路径，这次不输出 og:image（微信会抓不到封面）');
  }
}

if (rawProfile.meta && typeof rawProfile.meta === 'object') {
  Object.keys(rawProfile.meta).forEach((k) => {
    if (P.META_KEYS.indexOf(k) < 0) {
      warn('profile.json → meta：多了个没用到的字段 "' + k + '"（只认 ' + P.META_KEYS.join(' / ') + '）');
    }
  });
} else if (rawProfile.meta) {
  fail('profile.json → meta：应该是一个对象');
}

const metaView = {
  title: M.title,
  description: M.description,
  siteName: M.siteName,
  url: M.url,
  imageUrl: imageUrl,
  imageAlt: M.imageAlt,
  imageWidth: imageWidth,
  imageHeight: imageHeight
};

/* ---------------- 校验：头像 / 网页图标 ---------------- */
if (rawProfile.schema !== P.SCHEMA) {
  warn('profile.json：schema 应为 ' + P.SCHEMA + '，当前是 ' + JSON.stringify(rawProfile.schema));
}

/* 通用：相对路径的图片来源检查（头像用） */
function checkImagePath(src, at, required) {
  if (!src) {
    if (required) {
      fail(at + '：缺少 src（图片路径，例如 "assets/img/avatar-400.jpg"）');
    } else {
      warn(at + '：没有配置，对应的标签不会输出');
    }
    return false;
  }
  if (/^[\\/]/.test(src) && !/^\/\//.test(src)) {
    warn(at + '：src 别以 / 开头（' + src + '），部署到 GitHub Pages 子路径下会 404');
  }
  if (/\\/.test(src)) {
    warn(at + '：路径里的反斜杠要改成正斜杠（' + src + '）');
  }
  if (/^https?:\/\//i.test(src)) {
    /* 外链图片：不检查本地文件 */
    return true;
  }
  if (!fs.existsSync(path.join(root, src))) {
    fail(at + '：文件 ' + src + ' 不存在');
    return false;
  }
  return true;
}

/* ---------------- 校验：头像 ---------------- */
const AV = pp.avatar;

checkImagePath(AV.src, 'profile.json → avatar', true);
if (AV.src && !AV.alt) {
  warn('profile.json → avatar：没写 alt，屏幕阅读器只会念「图片」');
}
if (AV.src && !/\.(svg|png|jpe?g|webp|gif)$/i.test(AV.src)) {
  warn('profile.json → avatar：扩展名不是常见图片格式（' + AV.src + '）');
}

/* ---------------- 校验：站点图标 ---------------- */
const I = pp.icons;
const declaredPngSizes = {};

/* ICO：搜索引擎和老浏览器只认这个，缺了就会退回托管域名的图标 */
if (!I.ico) {
  warn('profile.json → icons.ico：没有配置 .ico 图标。Bing / 老浏览器只认 favicon.ico，' +
    '缺了会显示托管域名（github.io）的默认图标');
} else if (checkImagePath(I.ico.src, 'profile.json → icons.ico', true)) {
  const icoAbs = path.join(root, I.ico.src);
  try {
    const head = fs.readFileSync(icoAbs).subarray(0, 4);
    const isIco = head[0] === 0 && head[1] === 0 && head[2] === 1 && head[3] === 0;
    if (!isIco) {
      fail('profile.json → icons.ico：' + I.ico.src + ' 不是真正的 ICO 文件（可以跑 tools/make-icons.ps1 重新生成）');
    }
  } catch (e) {
    fail('profile.json → icons.ico：读不了 ' + I.ico.src);
  }
}

if (I.svg) {
  checkImagePath(I.svg.src, 'profile.json → icons.svg', false);
  if (!/\.svg$/i.test(I.svg.src)) {
    warn('profile.json → icons.svg：这个位置应放 .svg 文件（当前是 ' + I.svg.src + '）');
  }
}

if (!I.png.length) {
  warn('profile.json → icons.png：没有任何 PNG 尺寸，Google / Bing 抓缩略图时挑不到合适的');
}
I.png.forEach((item, i) => {
  const at = 'profile.json → icons.png[' + i + ']';
  if (!checkImagePath(item.src, at, true)) { return; }
  if (!/\.png$/i.test(item.src)) {
    warn(at + '：这个位置应放 .png 文件（当前是 ' + item.src + '）');
  }
  const size = pngSize(path.join(root, item.src));
  if (size) {
    const actual = size.width + 'x' + size.height;
    if (!item.sizes) {
      warn(at + '：没写 sizes，实际是 ' + actual + '（建议补上）');
      declaredPngSizes[item.src] = actual;
    } else if (item.sizes !== actual) {
      warn(at + '：sizes 写的是 ' + item.sizes + '，但图片实际是 ' + actual + '（已按实际值输出）');
    } else {
      declaredPngSizes[item.src] = actual;
    }
  } else if (!item.sizes) {
    warn(at + '：读不出图片尺寸，也没写 sizes，浏览器可能挑错尺寸');
  }
  if (item.sizes && !/^\d+x\d+$/.test(item.sizes)) {
    warn(at + '：sizes 应写成 "32x32" 这种形式（当前是 ' + item.sizes + '）');
  }
});

if (I.appleTouch) {
  checkImagePath(I.appleTouch.src, 'profile.json → icons.appleTouch', false);
  if (!I.appleTouch.sizes) {
    warn('profile.json → icons.appleTouch：没写 sizes，默认按 180x180 输出');
  }
}

/* sizes 一律用图片实测值，避免 JSON 里写了旧数字 */
pp.icons.png.forEach((item) => {
  if (declaredPngSizes[item.src]) { item.sizes = declaredPngSizes[item.src]; }
});

/* 字段名检查 */
Object.keys(rawProfile).forEach((k) => {
  if (P.LEGACY_ICON_KEYS.indexOf(k) >= 0) {
    fail('profile.json：顶层字段 "' + k + '" 已经合并进 icons（现在写 icons.ico / icons.svg / icons.png / icons.appleTouch）');
    return;
  }
  if (P.ALLOWED_KEYS.indexOf(k) < 0) {
    warn('profile.json：多了个没用到的字段 "' + k + '"（只认 ' + P.ALLOWED_KEYS.join(' / ') + '）');
  }
});

if (rawProfile.icons && typeof rawProfile.icons === 'object') {
  Object.keys(rawProfile.icons).forEach((k) => {
    if (P.ICON_KEYS.indexOf(k) < 0) {
      warn('profile.json → icons：多了个没用到的字段 "' + k + '"（只认 ' + P.ICON_KEYS.join(' / ') + '）');
    }
  });
} else if ('icons' in rawProfile) {
  fail('profile.json → icons：应该是一个对象');
}

Object.keys(rawProfile.avatar || {}).forEach((k) => {
  if (['src', 'alt', 'width', 'height'].indexOf(k) < 0) {
    warn('profile.json → avatar：多了个没用到的字段 "' + k + '"（只认 src / alt / width / height）');
  }
});

/* ---------------- 校验：页脚链接 ---------------- */
const L = pp.links;

if (rawProfile.links && typeof rawProfile.links !== 'object') {
  fail('profile.json → links：应该是一个对象（{ "github": …, "email": …, "rss": … }）');
} else if (rawProfile.links && typeof rawProfile.links === 'object') {
  Object.keys(rawProfile.links).forEach((k) => {
    if (P.LINK_KEYS.indexOf(k) < 0) {
      warn('profile.json → links：多了个没用到的字段 "' + k + '"（只认 ' + P.LINK_KEYS.join(' / ') + '）');
    }
  });
}

if (L.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(L.email)) {
  warn('profile.json → links.email：看着不像邮箱地址（' + L.email + '）');
}
['github', 'rss'].forEach((k) => {
  const v = L[k];
  if (!v) { return; }
  if (!/^https?:\/\//i.test(v)) {
    warn('profile.json → links.' + k + '：建议写完整地址（http:// 或 https:// 开头），当前是 ' + v);
  }
});
if (!L.github && !L.email && !L.rss) {
  warn('profile.json → links：三个都没填，页脚会空着');
}

/* ---------------- 同步标记区间 ---------------- */
function indent(text, n) {
  const pad = ' '.repeat(n);
  return text.split('\n').map((line) => (line ? pad + line : line)).join('\n');
}

function replaceRegion(file, mark, body) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    return { ok: false, why: '文件不存在' };
  }
  const src = fs.readFileSync(abs, 'utf8');
  /* 起止标记都连同所在行的缩进一起匹配，否则中间那段惰性匹配会吃掉
     结束标记前的缩进，标记会一路挪到行首。 */
  const re = new RegExp(
    '(^[ \\t]*<!--\\s*' + mark + ':start[^>]*-->)([\\s\\S]*?)(^[ \\t]*<!--\\s*' + mark + ':end\\s*-->)',
    'm'
  );
  const m = src.match(re);
  if (!m) {
    return { ok: false, why: '缺少 <!-- ' + mark + ':start --> / <!-- ' + mark + ':end --> 标记' };
  }
  if (m[2].trim() === body.trim()) {
    return { ok: true, changed: false };
  }
  const next = src.replace(re, (all, a, _mid, c) => a + '\n' + body + '\n' + c);
  if (!CHECK_ONLY) {
    fs.writeFileSync(abs, next, 'utf8');
  }
  return { ok: true, changed: true };
}

/* 表驱动：加一类数据只要往这里加一行 */
const REGIONS = [
  { mark: 'sites', label: '分站点卡片', indent: 6, body: () => S.gridHTML(ds) },
  { mark: 'profile:meta', label: '标题与分享卡片', indent: 0, body: () => P.metaHTML(metaView) },
  { mark: 'profile:avatar', label: '头像', indent: 6, body: () => P.avatarHTML(pp) },
  { mark: 'profile:icons', label: '网页图标与头像预载', indent: 0, body: () => P.iconsHTML(pp) },
  { mark: 'profile:links', label: '页脚链接', indent: 6, body: () => P.linksHTML(pp) },
  { mark: 'profile:contact', label: '联系我按钮', indent: 6, body: () => P.contactButtonHTML(pp) }
];

const results = REGIONS.map((r) => {
  const body = indent(r.body(), r.indent);
  const res = replaceRegion(TARGET, r.mark, body);
  if (!res.ok) { fail(TARGET + '：' + r.label + ' —— ' + res.why); }
  return { label: r.label, changed: !!res.changed };
});

/* ---------------- 输出 ---------------- */
console.log('profile.json');
console.log('  · 标题：' + M.title);
if (metaView.imageUrl) {
  const dim = (metaView.imageWidth && metaView.imageHeight)
    ? '（' + metaView.imageWidth + '×' + metaView.imageHeight + '）' : '';
  console.log('  · 封面：' + metaView.imageUrl + dim);
}
console.log('  · 头像：' + AV.src);
if (I.ico) { console.log('  · 图标 .ico：' + I.ico.src + '（搜索引擎 / 老浏览器用）'); }
if (I.svg) { console.log('  · 图标 .svg：' + I.svg.src); }
if (pp.icons.png.length) {
  console.log('  · 图标 .png：' + pp.icons.png.map((x) => x.sizes || '?').join(' / '));
}
if (I.appleTouch) {
  console.log('  · 主屏图标：' + I.appleTouch.src + '（' + (I.appleTouch.sizes || '180x180') + '）');
}
if (pp.links.github) { console.log('  · GitHub：' + pp.links.github); }
if (pp.links.email) { console.log('  · Email：' + pp.links.email); }
if (pp.links.rss) { console.log('  · RSS：' + pp.links.rss); }

console.log('sites.json：' + ds.total + ' 个分站点');
ds.sites.forEach((s) => {
  const link = s.placeholder ? '（占位，未配链接）' : s.href;
  console.log('  · ' + s.title + '（' + s.id + '）→ ' + link);
});

const touched = results.filter((r) => r.changed).map((r) => TARGET + '（' + r.label + '）');

if (CHECK_ONLY) {
  if (touched.length) {
    console.log('\n需要同步：' + touched.join('、') + '（去掉 --check 可写入）');
  } else {
    console.log('\n✓ 页面和 sites.json / profile.json 一致');
  }
} else if (touched.length) {
  console.log('\n已同步：' + touched.join('、'));
} else {
  console.log('\n✓ 页面和 sites.json / profile.json 一致，无需改动');
}

if (warnings.length) {
  console.log('\n⚠ ' + warnings.length + ' 条提醒：');
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.log('\n✖ ' + errors.length + ' 处错误（页面可能不完整）：');
  errors.forEach((e) => console.log('  - ' + e));
  process.exitCode = 1;
}
