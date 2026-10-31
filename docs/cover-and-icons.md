# 网站封面与图标指南

一份**通用**说明：任何网站（静态站、博客、个人主页、文档站都算）都能照着做。
文中地址统一用 `https://example.com/` 举例，换成你自己的域名即可。

站上一共有**三种长得像「图」**的东西，用途完全不同，别混在一起处理：

| 类型 | 常见字段名 | 出现在哪 | 典型尺寸 |
| --- | --- | --- | --- |
| 站点图标（favicon） | `<link rel="icon">` | 浏览器标签页、书签、**搜索结果左侧的小图标** | 16 / 32 / 48 / 180 / 192 / 512 |
| 分享封面（OG image） | `og:image` | 微信 / QQ / 飞书 / Slack / Twitter 的链接卡片 | 方图 800×800 或 1200×1200；宽图 1200×630 |
| 页面内图片 | 你自己的 `<img>` | 页面内部 | 按显示尺寸的 2～3 倍 |

---

## 1. 站点图标（favicon）

### 最少要给两样东西

```html
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32">
```

- **`/favicon.ico` 放在站点根目录**：这是浏览器和搜索引擎默认会尝试的路径，放这里就不依赖
  `<link>` 是否被正确解析。
- **`sizes` 要写 ICO 里真实包含的尺寸**（用空格分隔）。`sizes="any"` 只该给 SVG 用：
  它等于告诉浏览器「这张图任意尺寸都清晰」，浏览器就会把 ICO 当作可缩放图去挑，
  在高分屏（平板、DPR ≥ 2 的手机）上把这个位图放大后显示，结果就是**图标糊**。
  写的尺寸必须和 ICO 目录里实际存的条目一致，写大了同样会被放大。
- **PNG 多尺寸**：搜索引擎抓缩略图时会按 `sizes` 挑合适的，给 16 / 32 / 192 / 512 比较稳妥。

### 完整推荐写法

```html
<!-- 兜底：搜索引擎、老浏览器。sizes 写 ICO 内部的真实尺寸，别写 any -->
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<!-- 现代浏览器首选，矢量最清晰；但搜索引擎不认。这里才用 sizes="any" -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any">
<!-- 多尺寸 PNG -->
<link rel="icon" href="/icon-16.png" type="image/png" sizes="16x16">
<link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="icon" href="/icon-512.png" type="image/png" sizes="512x512">
<!-- iOS「添加到主屏幕」 -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
```

顺序有意义：**`.ico` 放最前当兜底**，后面依次是更清晰的选择。

图标文件可以放子目录（如 `/assets/img/...`），只要 `<link>` 指对就行——**但 `.ico` 建议留在根目录**。

### 部署在子路径时要注意

如果站点不是挂在域名根目录（例如 `https://example.com/blog/`、GitHub Pages 项目站的
`https://用户名.github.io/仓库名/`），上面这种 `/favicon.ico` 的**根路径写法会 404**。
两种正确做法：

- 用**相对路径**：`href="favicon.ico"`、`href="assets/img/icon-32.png"`；或
- 带上子路径：`href="/blog/favicon.ico"`。

需要特别注意的一点：**没有显式 `<link rel="icon">` 时，浏览器和爬虫自动探测的是「域名根」**
（`https://example.com/favicon.ico`），**不是** `/blog/favicon.ico`。对子路径站点来说，
那个地址属于域名所有者、不属于你——GitHub Pages 项目站上它就是 `用户名.github.io` 的图标。
所以子路径站点**必须显式写 `<link rel="icon">`**，不能指望自动探测。

### 尺寸对照

| 尺寸 | 用途 |
| --- | --- |
| 16×16 | 浏览器标签页（1x 屏）、书签 |
| 32×32 | 浏览器标签页（2x 屏）、任务栏 |
| 48×48 | Windows 桌面快捷方式、部分搜索引擎 |
| 180×180 | iOS「添加到主屏幕」 |
| 192×192 / 512×512 | Android 主屏、PWA、富摘要 |

> 大尺寸（192）**也塞进 ICO** 是值得的：有些浏览器和系统只认 `/favicon.ico`，
> 既不读 `<link>` 也不读 manifest，里面没有大图它们就把 48 放大成桌面/主屏图标 —— 就是「糊」。

设计要点：**16px 也要能认出来**。细节多、颜色杂的图在标签页里就是一团糊，
简洁的符号或字母比照片效果好得多。

> 想要圆角图标：圆角必须"镂空"（透明）才看得出来。如果导出 PNG 时不带透明通道、或者在
> 透明区域下面铺了不透明底色，圆角就会被底色填满，看起来仍然是方图。iOS 会自己给图标套
> 圆角/超椭圆遮罩，所以给 iOS 的那张（apple-touch-icon）保持**不透明满版**反而更稳。

---

## 2. 分享封面（Open Graph）

社交平台拼链接卡片时用它，`og:*` 放在 `<head>` 里。

```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="站点名">
<meta property="og:title" content="页面标题">
<meta property="og:description" content="一句能准确概括页面的描述">
<meta property="og:url" content="https://example.com/当前页面">
<meta property="og:image" content="https://example.com/cover.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
<meta property="og:image:alt" content="封面图描述">

<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="页面标题">
<meta name="twitter:description" content="一句能准确概括页面的描述">
<meta name="twitter:image" content="https://example.com/cover.png">
```

### 几条硬性要求

1. **`og:image` 必须是绝对地址**（`https://` 开头）。微信、QQ 等都不会去猜相对路径。
2. **声明尺寸要跟图片实际一致**。声明 `1200×630` 却给一张 800×800，部分客户端会裁得很怪。
3. **图片必须公网可访问**：不需要登录，别用 `Content-Disposition: attachment`，也别放在需要鉴权的位置。
4. **图片别太大**：几百 KB 足够，超过 1～2 MB 有些客户端会直接不抓。

### 页面标题与分享标题

`<title>` 决定浏览器标签页，`og:title` 决定分享卡片。两者**不必逐字相同**，常见组合是：

- 标签页用短名（方便开一堆标签时分清）：`文章名` 或 `站点名`；
- 分享卡片用带站点的完整标题：`文章名 · 站点名`。

要避免的只有一种情况：**改了一处忘了另一处**，出现「标签页是新名字、分享出去还是旧名字」。
改标题时把 `<title>`、`og:title`、`twitter:title` 一起过一遍。

### 用方图还是宽图

| 平台 | 推荐比例 |
| --- | --- |
| 微信收藏 / 微信分享 | **正方形**（800×800 或 1200×1200），缩略图按方裁 |
| Facebook / LinkedIn / Twitter(X) 大卡 | 1.91:1（1200×630） |
| Twitter 小卡（`summary`） | 1:1 |

只能选一种时，**方图最不容易出问题**。配 `twitter:card` 时：方图用 `summary`，
宽图用 `summary_large_image`（按图片实际宽高判断，宽高基本相等就是方图）。

### 页面描述

```html
<meta name="description" content="一句能准确概括页面的描述，80 字以内。">
```

搜索引擎摘要和部分平台都会用它，建议和 `og:description` 保持一致。

---

## 3. 最常见的坑

### 搜索引擎显示的是「托管平台的图标」

典型场景：站点部署在 GitHub Pages / Netlify / Vercel，搜索结果里显示的却是
GitHub / Netlify 的小图标。

原因基本就三个：

1. **只提供了 SVG favicon** —— 很多搜索引擎**不支持 SVG 格式的 favicon**；
2. **域名根目录没有 `/favicon.ico`** —— 没有显式 `<link>` 时，浏览器/爬虫会去请求
   `https://域名/favicon.ico`；子路径站点除非显式声明，否则拿不到自己的图标；
3. 图标路径 404（大小写、子目录写错、文件改了没同步）。

所以：**一定要显式写 `<link rel="icon" href="…ico">`，并且它指向的文件真的能打开。**

### 缓存很顽固

- **浏览器**：`Ctrl + Shift + R` 硬刷。
- **favicon 尤其顽固**：可以给 URL 加版本号（`?v=2`），或者干脆换个文件名。
- **社交平台**（微信 / 飞书等）会缓存卡片：重新分享一次，或换个会话发。
- **搜索引擎**：几天到几周都可能，见下一节。

---

## 4. 让搜索引擎更新图标

改完并部署后，按顺序做：

1. **先确认线上文件真的存在**（这一步最关键，八成问题都出在这里）：

   ```bash
   curl -I https://example.com/favicon.ico
   # 期望：200 + Content-Type: image/x-icon 或 image/vnd.microsoft.icon
   ```

   Windows PowerShell 5.1 里 `curl` 是 `Invoke-WebRequest` 的别名、不支持 `-I`，
   得写 `curl.exe -I …`，或者 `Invoke-WebRequest -Method Head https://example.com/favicon.ico`。

   在浏览器里直接打开 `https://example.com/favicon.ico`，能看到图标就说明没问题。

2. **Bing Webmaster Tools** → 添加站点 → 提交首页 URL，或用抓取工具查看它拿到的 `<link rel="icon">`。
3. **Google Search Console** → 「网址检查」→ 请求重新编入索引。
4. **耐心等**：搜索引擎的图标缓存刷新通常是几天到几周。
5. 如果站点收录本身就很少（搜 `site:example.com` 结果寥寥），可以提交 `sitemap.xml` 帮助收录。

---

## 5. 自检清单

- [ ] `<link rel="icon">` 指向的 ICO 能直接打开，返回的是图标（不是 404、不是 HTML）
- [ ] 站点在子路径时，图标路径带上了子路径（或用了相对路径），没有写死域名根的 `/favicon.ico`
- [ ] `<head>` 里有 `.ico` + 至少一个 PNG 的 `<link rel="icon">`
- [ ] ICO 的 `sizes` 写的是文件内部真实尺寸（不是 `any`），PNG 的 `sizes` 与图片宽高一致
- [ ] 高 DPR 设备（平板 / 手机）上标签页图标不糊 —— 糊就说明位图被放大了，回去查 `sizes`
- [ ] 有 `site.webmanifest`，里面 192 / 512 图标路径能打开
- [ ] 每个图标 URL 都能 200（F12 → Network 里筛 `icon` 看状态码）
- [ ] `og:image` 是绝对地址，`https://` 开头且公网能直接打开
- [ ] `og:image` 的实际宽高与 `og:image:width/height` 一致
- [ ] `<title>`、`og:title`、`twitter:title` 是新标题，不是旧标题
- [ ] 硬刷浏览器后标签页图标正常
- [ ] 在社交平台里实际分享一次，标题和封面都对

---

## 6. 常见问题

**Q：只给 SVG 不行吗？**
对现代浏览器可以，对搜索引擎不行。Bing 明确不支持 SVG favicon，且很多爬虫只请求
`/favicon.ico`。

**Q：`favicon.ico` 一定要放根目录吗？**
不是必须，但**强烈建议**。放根目录是 `https://域名/favicon.ico` 能直接命中，最省事也最保险；
放子目录就必须依赖 `<link>` 被正确解析。

**Q：图标和头像可以共用一张图吗？**
技术上可以，但不建议：照片缩到 16px 会糊成一团，图标应该是简洁的符号。

**Q：改了图标，分享封面会跟着变吗？**
不会。图标（favicon）和封面（og:image）是两套完全独立的东西。

**Q：需要 web app manifest 吗？**
不做 PWA 也建议放一个（几行 JSON）：Android / 平板浏览器在「添加到主屏幕」和桌面快捷方式里
优先用 manifest 的 192 / 512 图标，比 ICO 清晰得多。和搜索引擎缩略图无关。
注意 manifest 里的 `icons.src` 是**相对 manifest 文件自身**解析的，`start_url: "./"` 也是同样相对它。

**Q：ICO 里的图像用什么格式？**
现代浏览器和搜索引擎都支持「ICO 容器 + 内部各尺寸 PNG」，用脚本从已有的 PNG 拼一个多尺寸
ICO 即可（16/32/48 再加一个 192 就够），不用自己写 BMP 编码。

---

## 附录：落地步骤（与框架无关）

不管用什么建站方式，落地都是这四步：

1. **准备图片**

   | 文件 | 尺寸 | 说明 |
   | --- | --- | --- |
   | `favicon.ico` | 内含 16/32/48 + 一个 192 | 放**站点根目录** |
   | `icon-16.png` / `icon-32.png` | 16 / 32 | 标签页 |
   | `icon-192.png` / `icon-512.png` | 192 / 512 | Android / PWA / 富摘要 |
   | `apple-touch-icon.png` | 180 | iOS 主屏，**不透明满版** |
   | `cover.png`（名字随意） | 800×800 方图 | 分享封面，也可另出 1200×630 宽图 |

   有矢量源（SVG）时，从它导出各尺寸最清晰；没有就用设计工具另存。

2. **写进 `<head>`**：按本文第 1、2 节的模板填；站点若在子路径，图标路径记得用相对路径。

3. **构建时校验（建议）**：如果你的站点有构建脚本，加几行检查会很省事——
   图标文件是否存在、`sizes` 与图片真实宽高是否一致、`og:image` 是不是绝对地址、
   封面是不是方图。这几项出错时直接让构建失败，比部署完再发现好得多。

4. **发布后验证**：按第 4、5 节做一遍——先确认线上 `/favicon.ico` 能打开，
   再硬刷浏览器看标签页，最后在社交平台实际分享一次。

> 具体到某个项目用哪个配置文件、跑哪条命令，看那个项目自己的 README——本文只讲通用规则。
