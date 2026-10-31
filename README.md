# 时光不语 · 主页

纯静态个人主页：头像、昵称、简介，以及通往各分站点的跳转卡片。

页面里由脚本维护的内容都放在 JSON 里：

| 数据文件 | 管什么 | 同步方式 |
| --- | --- | --- |
| `sites.json` | 分站点卡片 | 运行时 fetch 现渲染 + 静态兜底 |
| `profile.json` | 站点信息、头像、图标、封面 | 构建期写进 HTML |

## 目录结构

```
.
├── index.html        # 页面骨架（带标记的区间是脚本生成的，别手改）
├── sites.json        # ★ 分站点清单
├── profile.json      # ★ 站点信息 / 头像 / 图标 / 链接
├── favicon.ico       # 根目录图标（内含 16/32/48/192，搜索引擎只认这个路径）
├── site.webmanifest  # Android / PWA 图标清单（脚本生成）
├── script/           # 所有 JS（页面脚本 + 同步工具）
├── assets/           # 样式与图片
├── docs/             # 文档（封面与图标指南）
├── tools/            # 一键同步、生成图标的脚本
├── .gitignore        # 忽略临时目录、系统垃圾、依赖
├── .nojekyll         # 让 GitHub Pages 跳过 Jekyll 处理
└── README.md
```

页面只加载 `script/` 里的 `sites.js` 和 `main.js`，其余 JS 是 Node 侧工具，浏览器不会请求。

> 图标和封面有一套通用做法（三种「封面」的区别、为什么 Bing 会显示 GitHub 图标、
> 怎么让它更新），写在 **[docs/cover-and-icons.md](docs/cover-and-icons.md)** 里——
> 主体部分是**任何静态站点都能照做**的通用指南，文末附录才是本项目的具体配置。

## 站点信息、头像、图标、链接：都在 `profile.json`

```json
{
  "meta": {
    "title": "时光不语 · 主页",
    "description": "时光不语 的个人主页 —— 头像、简介，以及各个分站点的入口。",
    "siteName": "时光不语",
    "url": "https://vilotime.github.io/",
    "image": "assets/img/og-cover.png"
  },
  "avatar": {
    "src": "assets/img/avatar-400.jpg",
    "alt": "时光不语的头像"
  },
  "icons": {
    "ico": "favicon.ico",
    "svg": "assets/img/favicon.svg",
    "png": [
      { "src": "assets/img/icon-16.png",  "sizes": "16x16" },
      { "src": "assets/img/icon-32.png",  "sizes": "32x32" },
      { "src": "assets/img/icon-192.png", "sizes": "192x192" },
      { "src": "assets/img/icon-512.png", "sizes": "512x512" }
    ],
    "appleTouch": { "src": "assets/img/apple-touch-icon.png", "sizes": "180x180" }
  },
  "links": {
    "github": "https://github.com/VILOTIME",
    "email": "vilo.time@petalmail.com",
    "rss": "https://github.com/VILOTIME/vilotime.github.io/commits/main.atom"
  }
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `meta.title` | ✅ | 网页标题，同时用于浏览器标签页、`og:title`、`twitter:title` |
| `meta.description` | 建议填 | 页面描述 + `og:description` |
| `meta.siteName` | 可选 | `og:site_name` |
| `meta.url` | 建议填 | 站点根地址，把 `meta.image` 拼成绝对地址用 |
| `meta.image` | 建议填 | 分享 / 收藏封面。写本地路径（自动拼绝对地址并检查文件存在）或直接写 https 地址 |
| `meta.imageAlt` | 可选 | 封面替代文字，默认用 `meta.title` |
| `meta.imageWidth` / `imageHeight` | 可选 | 一般不用写：PNG 会读文件头自动取真实尺寸 |
| `avatar.src` | ✅ | 图片路径，jpg / png / webp / svg 都行；**正方形 400×400 左右最合适**（见下） |
| `avatar.alt` | 建议填 | 替代文字，不填脚本会提醒 |
| `avatar.width` / `height` | 可选 | 只用于布局占位，默认 140；显示尺寸由 CSS 决定 |
| `icons.ico` | **强烈建议** | `.ico` 放在仓库根目录（`favicon.ico`）。**搜索引擎只认这个**，缺了会显示 github.io 的默认图标。里面要含 16/32/48 **+ 192** |
| `icons.svg` | 可选 | 现代浏览器首选，矢量最清晰；但搜索引擎不认 SVG。只有它该写 `sizes="any"` |
| `icons.png` | **强烈建议** | 多尺寸 PNG 数组，每项 `{ "src": …, "sizes": "32x32" }` |
| `icons.appleTouch` | 可选 | iOS 主屏图标，一般 180×180 |
| `icons.manifest` | 可选 | `web app manifest`：不写就按默认生成 `site.webmanifest`，写 `false` 则关闭 |
| `links.github` | 可选 | 页脚 GitHub 入口，留空则不显示 |
| `links.email` | 可选 | 页脚 Email + 头部「联系我」按钮，写 `a@b.com` 即可（也接受 `mailto:` 前缀） |
| `links.rss` | 可选 | 页脚 RSS 入口，留空则不显示 |

`links` 里填了哪个就渲染哪个，分隔点自动处理；三个都不填页脚会空着（脚本会提醒）。
`meta.title` 一处改动就同步到标签页和收藏卡片，不会出现「浏览器是新名、微信收藏夹是旧名」。

### 图标用脚本生成

```powershell
.\tools\make-icons.ps1                 # 渐变底 + 白色 V
.\tools\make-icons.ps1 -Design avatar  # 用头像照片做图标
```

一次生成 `favicon.ico`（内含 **16/32/48 + 192**）+ `icon-16/32/192/512.png` + `apple-touch-icon.png`，并回读校验。
细节和排查方法见 [docs/cover-and-icons.md](docs/cover-and-icons.md)。

### ICO 的 sizes 为什么不能写 any

位图不像 SVG 那样「任意尺寸都清晰」。`<link rel="icon" sizes="any">` 等于告诉浏览器
「这张图多大都行」，于是它在高分屏（平板、DPR ≥ 2 的手机）上会把 ICO 里的 48 放大来用，**图标就糊了**。

所以同步脚本会**读 ICO 文件目录，把它内部真实包含的尺寸写进 `sizes`**（现在是
`16x16 32x32 48x48 192x192`）；`sizes="any"` 只留给 SVG。ICO 里缺少 192 时脚本会提醒。

### 头像该做多大

页面里头像固定显示 140px（窄屏 116px）。按 3x 屏算，最多需要 420px，所以**400×400 就够**，
再大只是白白拖慢首屏——之前那张 816×816 是 56.5 KB，缩到 400×400 后 32 KB。

另外同步脚本会自动给头像做两件事，不用你操心：

- 在 `<head>` 里插一条 `<link rel="preload" as="image" …fetchpriority="high">`，让它尽早开始下载；
- 给 `<img>` 加上 `fetchpriority="high"`，避免它被排在其它资源后面。

否则首屏会出现「头像从上面一行行刷出来」的观感——那多半不是图片坏了，是它到得太晚。

### 关于 RSS

这个站没有文章列表，所以 RSS 默认指向**本仓库的提交记录**

```
https://github.com/<用户名>/<仓库名>/commits/<分支>.atom
```

### 为什么点了邮件图标没反应？

`mailto:` 依赖系统里配置了邮件客户端。没配的话浏览器点了确实毫无动静，这不是页面坏了。
所以 Email 和「联系我」按钮都带了 `data-copy`：点击时会顺手把地址复制到剪贴板，并弹提示
「已复制：…」，没客户端就直接粘贴到别处。装了客户端的用户依然会正常打开写信窗口。

换步骤：

1. 把图片放进 `assets/img/`；
2. 改 `profile.json` 里的路径 / 链接；
3. 跑 `.\tools\sync.cmd`；
4. 刷新页面。**favicon 缓存很顽固**，看不到就 `Ctrl + Shift + R`。

图片路径写错会直接报错（脚本会检查文件是否真的存在），不会静默变成破图。
图片不要以 `/` 开头——部署到 GitHub Pages 子路径下会 404。

## 改分站点：动 `sites.json`

每个分站点一条记录：

```json
{
  "id": "blog",
  "title": "博客",
  "desc": "技术文章与随想，长期更新。",
  "href": "https://blog.example.com",
  "icon": "blog",
  "color": "#6d8cff",
  "tag": "blog"
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `id` | ✅ | 唯一标识（也用作默认 tag），不能重复 |
| `title` | ✅ | 卡片主标题 |
| `desc` | 建议填 | 卡片副标题 |
| `href` | 建议填 | 跳转地址。留空或 `#` 就变成占位卡片，点击只弹提示 |
| `icon` | 可选 | 图标 key，见下面的图标库；不填用回形针图标 |
| `color` | 可选 | 图标底色，形如 `#6d8cff`；不填用默认蓝 |
| `tag` | 可选 | 卡片右上角小标签，默认等于 `id` |
| `sameTab` | 可选 | `true` = 同页跳转（不新开标签页）；默认对绝对地址是 `false` |

### 链接在新标签页还是同页

| `href` 写法 | 跳转方式 |
| --- | --- |
| 相对路径，如 `"blogs/"` 或 `"./blogs/"` | **同页跳转**（天然同站） |
| 绝对地址，如 `"https://vilotime.github.io/blogs/"` | 新标签页（自动加 `target="_blank" rel="noopener noreferrer"`） |
| 绝对地址 + `"sameTab": true` | **同页跳转** |
| 留空或 `#` | 占位卡片，点击只弹提示 |

两个分站点都在本站目录下，所以现在是「绝对地址 + `sameTab: true`」，点进去就是同页跳转。
更省事的写法是把 `href` 直接改成相对路径（`"blogs/"`），这样换域名也不用改数据——
这时 `sameTab` 可以不写。

### 图标库

卡片图标是内联 SVG，维护在 `script/sites.js` 的 `ICONS` 里（现在有
`blog / notes / works / tools / gallery / about / link`）。加一个图标：往那里加一条
`key: '<path …>'`，就能在 `sites.json` 里用这个 key。

## 同步策略

`script/sync-html.js` 是表驱动的：每个数据文件负责几个「标记区间」，都在 `REGIONS` 表里声明，
加一类新数据只要加一行，不用改流程代码。

| 数据 | 写入 `index.html` 的区间 | 为什么这么处理 |
| --- | --- | --- |
| `sites.json` | `<!-- sites:start --> … <!-- sites:end -->` | 卡片 = 内容，http 下要能改完刷新即生效，所以运行时也渲染 |
| `profile.json` | `<!-- profile:meta:start --> … :end -->` | 标题 / 描述 / og 卡片：要一次生成，避免多处不同步 |
| `profile.json` | `<!-- profile:avatar:start --> … :end -->` | 头像 = 页面铬件，运行时重渲染没意义 |
| `profile.json` | `<!-- profile:icons:start --> … :end -->` | 图标 / manifest / 头像预载，换不优雅，只在构建期写 |
| `profile.json` | `<!-- profile:links:start --> … :end -->` | 页脚 GitHub / Email / RSS |
| `profile.json` | `<!-- profile:contact:start --> … :end -->` | 头部「联系我」按钮（复用 `links.email`） |

除了改 `index.html` 的区间，同步还会**单独写出 `site.webmanifest`**
（内容由 `profile.json` 的 `icons` / `meta` 推出来，也可以整个关掉）。

```powershell
.\tools\sync.cmd                     # 或双击；等价的直接调用是 node script/sync-html.js
node script/sync-html.js --check         # 只检查不写入（CI / 提交前用）
.\tools\sync.ps1 -Check -NoPause     # 同样的检查，附带 json 摘要
```

校验会挑出：id 重复、缺必填字段、颜色不是合法 hex、图标 key 不存在、多了没用到的字段、
图片文件不存在、路径用了反斜杠或 `/` 开头。内容已经一致时不会重写文件。

**标记区间不要手改**——下次同步会被覆盖。

### 为什么卡片还要留一份 HTML 副本？

| 打开方式 | 卡片来源 |
| --- | --- |
| http（本地预览 / GitHub Pages） | 运行时 `fetch('sites.json')` 现渲染，改 json 刷新就生效 |
| 双击 `index.html`（file://） | 浏览器不允许 `fetch` 本地文件，用 `index.html` 里的静态兜底 |
| 禁用 JS / 断网 / 爬虫 | 同上，用静态兜底 |

## 本地预览

```powershell
.\tools\sync.ps1 -Serve                         # 同步后起预览，默认 8080
node script/dev.js --port 8123 --no-open         # 只起服务，不自动开浏览器
python -m http.server 8000                      # 最省事的方式，也能用
```

预览服务器同时监听 `sites.json` 和 `profile.json`：保存 → 自动同步 → 浏览器 `Ctrl + R`。

## 换掉其它占位内容

| 改什么 | 改哪里 |
| --- | --- |
| 昵称 / @handle | `index.html` 的 `.profile__name`、`.profile__handle`（这处仍手写，未进 JSON） |
| 一句话简介 / 正文简介 | `.profile__tagline`、`.profile__bio` |
| 标签 | `.chips` 里的 `<li class="chip">` |
| 头像 | `profile.json` 的 `avatar` |
| 网页图标、分享封面 | `profile.json` 的 `icons` / `meta.image`（详见 [docs/cover-and-icons.md](docs/cover-and-icons.md)） |
| 分站点 | `sites.json`（见上） |
| 整体配色 | `style.css` 顶部 `:root` 变量，浅色主题在 `[data-theme="light"]` |
| 底部署名链接（GitHub / Email / RSS） | `profile.json` 的 `links` |
| 在线状态角标 | `.avatar__badge`，不想要就删掉这个元素 |
| 网页标题 / 描述 / 分享封面 | `profile.json` 的 `meta` |

## 分享 / 收藏卡片（微信、QQ 等）

微信收藏和分享读的是页面头部的 `og:*` 标签，**不是 `<title>`** —— 这就是为什么只改 `<title>`
会出现「浏览器标签页是新名、收藏夹还是旧名」。

所以这两处现在由 `profile.json` 的 `meta` 一并在生成：

```json
"meta": {
  "title": "时光不语 · 主页",
  "description": "时光不语 的个人主页 —— 头像、简介，以及各个分站点的入口。",
  "siteName": "时光不语",
  "url": "https://vilotime.github.io/",
  "image": "assets/img/og-cover.png"
}
```

同步后会生成 `<!-- profile:meta:start -->` 区间里的内容：`<title>`、`meta description`、
`og:type / og:site_name / og:title / og:description / og:url / og:image(+width/height/alt)`、
以及一套 `twitter:*`。

关于封面 `meta.image`：

- 写**本地路径**（如 `assets/img/og-cover.png`）时，脚本会用 `meta.url` 拼成绝对地址、
  并检查文件真的存在；PNG 还会读文件头自动填 `og:image:width/height`，换图不用改数字。
- 也可以直接写 https 地址（外链图片），此时不做本地检查。
- `meta.url` 不是完整地址时，**不会输出 `og:image`**（微信抓不到相对路径，宁可不出也不要出错的）。

三个注意点：

1. **必须是绝对地址**（带 `https://域名/`），微信不会去猜相对路径；
2. **用正方形图**（如 800×800 / 1000×1000）：微信收藏和分享的缩略图是按正方形裁的，
   给 1200×630 这种宽图会被切掉两边。方图还有一个好处——`twitter:card` 会自动变成
   `summary`（方形缩略图），宽图才用 `summary_large_image`；
3. 微信对 `og` 信息有很强的缓存，改完可能要多刷几次、或换个链接（比如加 `?v=2`）才看到新封面，
   已经收藏过的条目通常得取消收藏再收一次。

封面内容要**照顾小尺寸**：缩略图只有一百多像素，字要够大、对比要够强。
当前的 `og-cover.png` 是 800×800，头像 + 名字 + 一句话，内容都留了 100px 以上边距，
方形裁切不会切到东西。

站点地址如果不是 `https://vilotime.github.io/`（比如仓库名不同、或者是项目页 `/repo/` 子路径），
改 `meta.url` 一处即可，封面地址会跟着变。

## 已实现的小细节

- 深色 / 浅色主题切换，选择记在 `localStorage`，首次访问跟随系统偏好
- 头像外圈渐变光环缓慢旋转，卡片悬停有描边高光与轻微浮起
- **头像下载完才显示**：下载期间只露一个会呼吸的占位圆，避免慢网络下看到「半张脸从上往下刷」；
  禁用 JS 时退化为直接显示（`<noscript>` 兜底）
- 滚动入场动效，`prefers-reduced-motion` 自动降级；观察器万一不回调也有兜底
- 卡片内容与 `sites.json` 一致时**不重建 DOM**（只比对卡片数据，不比 HTML 字符串），
  所以入场动画只播一遍；只有 json 真的改了才替换节点，且替换后直接显示、不再补播动画
- 完全响应式，窄屏单列排布
- 无外部字体、无框架、无构建依赖
