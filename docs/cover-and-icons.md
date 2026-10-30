# 封面与图标说明

这个站上一共有**三种长得像「图」**的东西，用途完全不同，别混在一起改。
全部配置都在 `profile.json` 里，`tools\sync.cmd` 一次写进 `index.html`。

| 类型 | JSON 字段 | 出现在哪 | 典型尺寸 |
| --- | --- | --- | --- |
| 站点图标（favicon） | `icons.*` | 浏览器标签页、书签、**搜索结果左侧的小图标** | 16/32/48/192/512 |
| 分享封面（og:image） | `meta.image` | 微信/QQ/Twitter/飞书的链接卡片、微信收藏 | 800×800 方图 |
| 页面头像 | `avatar` | 页面正中间那张大图 | 400×400 |

---

## 1. 站点图标：`icons`

搜索引擎结果里那个小图标就是它。**这是最容易踩坑的一处。**

```json
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
}
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `ico` | **强烈建议** | `.ico` 文件，放在**仓库根目录**，即 `/favicon.ico`。搜索引擎和老浏览器只认这个 |
| `svg` | 可选 | 现代浏览器首选，矢量最清晰；但**搜索引擎不认** |
| `png` | **强烈建议** | 多尺寸 PNG。Google/Bing 抓缩略图时按 `sizes` 挑合适的 |
| `appleTouch` | 可选 | iOS「添加到主屏幕」的图标，一般 180×180 |

生成后的 HTML（这一段由脚本维护，不要手改）：

```html
<link rel="icon" href="favicon.ico" sizes="any" />
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml" />
<link rel="icon" href="assets/img/icon-16.png" type="image/png" sizes="16x16" />
<link rel="icon" href="assets/img/icon-32.png" type="image/png" sizes="32x32" />
<link rel="icon" href="assets/img/icon-192.png" type="image/png" sizes="192x192" />
<link rel="icon" href="assets/img/icon-512.png" type="image/png" sizes="512x512" />
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png" sizes="180x180" />
```

`.ico` 排在最前面是故意的：它是兜底，谁都能读；后面依次是更清晰的选择。

### 为什么以前 Bing 显示的是 GitHub 图标

因为站点原本只给了 **SVG favicon**：

- Bing（以及很多爬虫）**不支持 SVG 格式的 favicon**；
- 它们也不会老老实实解析 `<link rel="icon">`，而是直接请求 `https://你的域名/favicon.ico`；
- 根目录没有这个文件 → 抓不到 → 退回**托管域名**的图标，在 GitHub Pages 上就是 GitHub 的小图标。

补上根目录的 `favicon.ico` + 多尺寸 PNG 之后这个问题就没了。

### 文件都是哪来的

跑一次 `tools\make-icons.ps1` 全部生成：

```powershell
.\tools\make-icons.ps1              # 渐变底 + 白色 V（和 favicon.svg 一致）
.\tools\make-icons.ps1 -Design avatar   # 改用头像照片做图标
```

脚本会写出：根目录的 `favicon.ico`（内含 16/32/48 三个尺寸）+ `assets/img/` 下的
`icon-16/32/192/512.png` 和 `apple-touch-icon.png`，最后回读校验尺寸。

> `favicon.svg` 是手写的矢量版，脚本不会动它。如果你换了图标设计，记得把 SVG 也一起换掉，
> 否则现代浏览器（用 SVG）和搜索引擎（用 ICO）会显示两个不同的图标。

---

## 2. 分享封面：`meta.image`

微信收藏、QQ、Twitter 等平台拼链接卡片时用的大图。

```json
"meta": {
  "title": "时光不语 · 主页",
  "description": "时光不语 的个人主页 —— 头像、简介，以及各个分站点的入口。",
  "siteName": "时光不语",
  "url": "https://vilotime.github.io/",
  "image": "assets/img/og-cover.png"
}
```

脚本会自动：

1. 用 `meta.url` 把 `meta.image` 拼成**绝对地址**（微信不认相对路径）；
2. 读 PNG 文件头拿到真实宽高，写进 `og:image:width/height`（换图不用改数字）；
3. 方图自动配 `twitter:card=summary`，宽图自动切 `summary_large_image`；
4. `meta.url` 不是完整地址时**干脆不输出** `og:image`，免得塞一个抓不到的错误地址。

**为什么用方图**：微信收藏/分享的缩略图按正方形裁，1200×630 那种宽图会被切掉两边。
当前封面是 800×800，头像 + 名字 + 一句话，四周留白 ≥120px，怎么裁都不会切到内容。

换封面只要替换 `assets/img/og-cover.png`（保持 800×800 方图），JSON 都不用改。

---

## 3. 页面头像：`avatar`

```json
"avatar": {
  "src": "assets/img/avatar-400.jpg",
  "alt": "时光不语的头像"
}
```

页面里头像固定显示 140px（窄屏 116px），按 3x 屏算最多需要 420px，所以 **400×400 就够**。
之前放过 816×816 / 56 KB 的图，首屏会出现「从上往下一行行刷出来」的观感——不是图坏了，是它太大、到得太晚。

脚本还会自动给头像加两条提速：

- `<link rel="preload" as="image" … fetchpriority="high">`，让它尽早开始下载；
- `<img … fetchpriority="high">`，避免它被排在别的资源后面。

---

## 4. 改完怎么生效

```powershell
.\tools\sync.cmd      # 或 node script/sync-html.js
```

同步脚本会校验：

- 引用的文件**是否真的存在**；
- `.ico` 是不是**真的 ICO**（不是改了扩展名的 PNG）；
- PNG 的 `sizes` 和图片**实际尺寸**是否一致（不一致会按实际值输出并提醒）；
- 有没有漏掉 `.ico`（会直接提醒「Bing 会退回托管域名图标」）；
- 是否还在用旧的 `favicon` / `appleTouchIcon` 顶层字段（已合并进 `icons`，会报错提示迁移）。

---

## 5. 让搜索引擎更新图标

改完、推上去之后，Bing/Google 还不会立刻变，它们有自己的缓存。

1. **确认线上文件真的存在**：直接访问 `https://vilotime.github.io/favicon.ico`，
   应该能看到图标（不是 404）。这是最关键的一步。
2. **Bing Webmaster Tools** → 添加站点 → 「URL 提交」把首页重新提交一遍，
   或用「站点资源管理器」里的抓取工具看它拿到的 `<link rel="icon">`。
3. **Google Search Console** → 「网址检查」→ 请求重新编入索引。
4. 搜索引擎的图标缓存可能要**几天到几周**才刷新，这点急不来。

另外，如果你在 Bing 里搜 `site:vilotime.github.io` 只看到很少的结果，
说明站点收录本身还不全，可以在 Webmaster Tools 里提交一个 `sitemap.xml`（目前还没有，需要的话可以生成）。

---

## 6. 自检清单

改完图标后挨个确认：

- [ ] `https://vilotime.github.io/favicon.ico` 能直接下载，且是图标（不是 404、不是 HTML）
- [ ] 浏览器标签页图标正常（`Ctrl + Shift + R` 强刷后再看）
- [ ] `node script/sync-html.js --check` 输出 `✓ 页面和 sites.json / profile.json 一致`
- [ ] `index.html` 的 `head` 里有 `.ico`、`.svg`、多个 `.png` 的 `<link rel="icon">`
- [ ] 微信里分享/收藏，标题是「时光不语 · 主页」、封面是方形图
- [ ] Bing 的 `site:` 搜索里小图标换过来了（可能有延迟）

---

## 7. 常见问题

**Q：只给 SVG 不够吗？**
对浏览器够，对搜索引擎不够。Bing 明确不支持 SVG favicon，且很多爬虫只请求根目录的 `/favicon.ico`。

**Q：`favicon.ico` 为什么放根目录，不放到 `assets/img/`？**
放根目录是 `https://域名/favicon.ico` 能直接命中，这是爬虫和浏览器默认会尝试的路径，
最省事也最保险。放子目录就必须依赖 `<link>` 被正确解析。

**Q：图标和头像可以共用一张图吗？**
技术上可以，但不建议：头像通常是照片，缩到 16px 会糊成一团；图标应该是简洁的符号。
`tools\make-icons.ps1 -Design avatar` 可以用头像生成图标，但小尺寸下观感一般。

**Q：改完图标，微信收藏里的封面也变了吗？**
不会。图标（`icons`）和封面（`meta.image`）是两套东西，互不影响。
