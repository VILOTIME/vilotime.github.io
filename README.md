# 时光不语 · 个人主页

一个无构建步骤的纯静态个人主页：头像、昵称、简介，以及通往各分站点的跳转卡片。

页面里由脚本维护的内容都放在 JSON 里：

| 数据文件 | 管什么 | 同步方式 |
| --- | --- | --- |
| `sites.json` | 分站点卡片 | 运行时 fetch 现渲染 + 静态兜底 |
| `profile.json` | 头像、网页图标 | 构建期写进 HTML |

## 目录结构

```
.
├── index.html                # 页面骨架（带标记的区间都是脚本生成的，别手改）
├── sites.json                # ★ 分站点清单
├── profile.json              # ★ 头像 / 网页图标
├── script/                   # ★ 所有 JS（页面脚本 + 同步工具）
│   ├── sites.js              # 卡片渲染器（浏览器和 Node 共用同一套模板）
│   ├── main.js               # 主题切换、拉 json 渲染卡片、入场动效、占位提示
│   ├── profile.js            # 头像 / 图标的 HTML 渲染器（构建期专用，页面不引用）
│   ├── sync-html.js          # 把两个 json 同步进 index.html（--check 只检查）
│   └── dev.js                # 本地预览服务器 + 保存 json 自动同步
├── assets/
│   ├── css/style.css         # 全部样式，顶部是配色变量
│   └── img/
│       ├── avatar.jpg        # 头像
│       ├── avatar.svg        # 头像占位图（备用）
│       └── favicon.svg       # 网页图标
├── tools/                    # 只剩 Windows 入口脚本
│   ├── sync.ps1              # 一键同步（校验 + 调 script/sync-html.js + 可选起预览）
│   └── sync.cmd              # 双击运行 sync.ps1 的入口
├── .nojekyll                 # 让 GitHub Pages 跳过 Jekyll 处理
└── README.md
```

页面只加载 `script/sites.js` 和 `script/main.js`；`script/profile.js`、`script/sync-html.js`、`script/dev.js`
是给 Node 用的，浏览器不会请求它们（放在同一个文件夹只是为了「所有 JS 一处」）。

## 改头像和网页图标：动 `profile.json`

```json
{
  "schema": 1,
  "avatar": {
    "src": "assets/img/avatar.jpg",
    "alt": "时光不语的头像"
  },
  "favicon": {
    "src": "assets/img/favicon.png",
    "sizes": "32x32"
  },
  "appleTouchIcon": null,
  "links": {
    "github": "https://github.com/VILOTIME",
    "email": "vilo.time@petalmail.com",
    "rss": "https://github.com/VILOTIME/vilotime.github.io/commits/main.atom"
  }
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `avatar.src` | ✅ | 图片路径，jpg / png / webp / svg 都行；建议正方形 512×512 |
| `avatar.alt` | 建议填 | 替代文字，不填脚本会提醒 |
| `avatar.width` / `height` | 可选 | 只用于布局占位，默认 140；显示尺寸由 CSS 决定 |
| `favicon.src` | 建议填 | 网页图标；不填就不输出图标标签 |
| `favicon.type` | 可选 | 一般不用写，脚本按扩展名自动推断 |
| `favicon.sizes` | 可选 | 例如 `32x32`（PNG/ICO 才需要，SVG 不用写） |
| `appleTouchIcon` | 可选 | 加 iOS 主屏图标，填 `{ "src": "图片路径" }`；不要就写 `null` |
| `links.github` | 可选 | 页脚 GitHub 入口，留空则不显示 |
| `links.email` | 可选 | 页脚 Email + 头部「联系我」按钮，写 `a@b.com` 即可（也接受 `mailto:` 前缀） |
| `links.rss` | 可选 | 页脚 RSS 入口，留空则不显示 |

`links` 里填了哪个就渲染哪个，分隔点自动处理；三个都不填页脚会空着（脚本会提醒）。

### 关于 RSS

这个站没有文章列表，所以 RSS 默认指向**本仓库的提交记录**（GitHub 自带 Atom 源）：

```
https://github.com/<用户名>/<仓库名>/commits/<分支>.atom
```

零维护、内容真实，提交一次就有更新。等以后有了文章页，把 `links.rss` 换成自己的 `feed.xml` 即可。

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

以 `http(s)://` 或 `mailto:` 开头的 `href` 会自动加 `target="_blank" rel="noopener noreferrer"`；
站内相对路径（如 `./blog/`）则在本页跳转。

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
| `profile.json` | `<!-- profile:avatar:start --> … :end -->` | 头像 = 页面铬件，运行时重渲染没意义 |
| `profile.json` | `<!-- profile:icons:start --> … :end -->` | favicon 换不优雅，只在构建期写 |
| `profile.json` | `<!-- profile:links:start --> … :end -->` | 页脚 GitHub / Email / RSS |
| `profile.json` | `<!-- profile:contact:start --> … :end -->` | 头部「联系我」按钮（复用 `links.email`） |

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
| 昵称 / @handle | `index.html` 的 `.profile__name`、`.profile__handle` |
| 一句话简介 / 正文简介 | `.profile__tagline`、`.profile__bio` |
| 标签 | `.chips` 里的 `<li class="chip">` |
| 头像 | `profile.json` 的 `avatar` |
| 网页图标 | `profile.json` 的 `favicon` / `appleTouchIcon` |
| 分站点 | `sites.json`（见上） |
| 整体配色 | `style.css` 顶部 `:root` 变量，浅色主题在 `[data-theme="light"]` |
| 底部署名链接（GitHub / Email / RSS） | `profile.json` 的 `links` |
| 在线状态角标 | `.avatar__badge`，不想要就删掉这个元素 |
| 分享卡片 `og:image` | `index.html` 的 meta（目前只有 `og:title` / `og:description`） |

## 部署到 GitHub Pages

仓库名是 `vilotime.github.io`，属于「用户主页」站点：

```powershell
git init
git add .
git commit -m "feat: 个人主页 + sites.json / profile.json 同步流程"
git branch -M main
git remote add origin https://github.com/<你的用户名>/vilotime.github.io.git
git push -u origin main
```

然后 **Settings → Pages** → Source 选 `Deploy from a branch`，分支 `main`、目录 `/ (root)`，
保存后访问 `https://<你的用户名>.github.io/`。

`.nojekyll` 是个空文件，但**文件名本身就是内容**：它告诉 GitHub Pages 别跑 Jekyll，
直接把仓库原样发布。删掉也能上线，只是以后如果加了 `_` 或 `.` 开头的目录/文件，
Jekyll 会悄悄忽略它们 —— 留着它零成本。

## 已实现的小细节

- 深色 / 浅色主题切换，选择记在 `localStorage`，首次访问跟随系统偏好
- 头像外圈渐变光环缓慢旋转，卡片悬停有描边高光与轻微浮起
- 滚动入场动效，`prefers-reduced-motion` 自动降级；观察器万一不回调也有兜底
- 完全响应式，窄屏单列排布
- 无外部字体、无框架、无构建依赖
