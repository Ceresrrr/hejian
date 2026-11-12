# 把合鉴发布成一个人人可开的网站

合鉴是**纯静态站**：没有后端、没有数据库、没有外部请求，`dist/` 全部文件不到 1 MB。

发布路径有两条：**GitHub Pages**（仓库自带工作流，推上去就有网址）和**任意静态托管 + 自己的域名**。

---

## 一、GitHub Pages（推荐，零成本）

### 1. 换成你的账号

仓库里的链接、`og:url`、`sitemap.xml`、`robots.txt` 里都是占位账号，一条命令替换：

```bash
node tools/set-site.mjs <你的GitHub账号>          # 仓库名默认 hejian
node tools/set-site.mjs <你的GitHub账号> crown    # 想用别的仓库名
```

### 2. 推上去

```bash
git init -b main
git add .
git commit -m "合鉴：十二文明 1229 位统治者"
git remote add origin https://github.com/<你的GitHub账号>/hejian.git
git push -u origin main
```

### 3. 打开开关

仓库 **Settings → Pages → Source** 选 **GitHub Actions**。

`.github/workflows/pages.yml` 会在每次 push 时依次执行：

```
node build-data.mjs   # TSV → js/data.js
node test.mjs         # 两万八千条断言
node pack.mjs         # 生成 dist/（只含上线文件）
→ upload-pages-artifact → deploy-pages
```

约 1 分钟后访问：

```
https://<你的GitHub账号>.github.io/hejian/
```

### 4. 用命令行手动发布（不用 Actions）

```bash
node test.mjs && node pack.mjs
npx gh-pages -d dist        # 推 dist/ 到 gh-pages 分支
```

然后在 Settings → Pages 里把 Source 改成「Deploy from a branch → gh-pages / (root)」。

---

## 二、绑自己的域名

### GitHub Pages + 自定义域名

1. 域名商处加解析：
   - 主域 `example.com` → A 记录指向 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`
   - `www` → CNAME 指向 `<账号>.github.io`
2. 在 `dist/` 里放一个 `CNAME` 文件（内容就是域名，如 `hejian.example.com`），或在仓库 Settings → Pages → Custom domain 里填。
3. 勾选 **Enforce HTTPS**，证书自动签发。

站点是纯静态、内容也不含用户数据，GitHub Pages 这条路径**不需要备案**（服务器不在境内）。

---

## 三、换别的托管

| 托管 | 费用 | 上手 | 备注 |
| --- | --- | --- | --- |
| **GitHub Pages** | 免费 | 推代码即发布 | 仓库 1 GB 软限制、月 100 GB 流量，本项目只有 1 MB 左右，够用 |
| **Cloudflare Pages** | 免费 | 连仓库或拖 `dist/` | 全球 CDN 快，支持 `_headers`（本项目已带） |
| **Vercel** | 免费额度 | 连仓库 | 预览部署方便，国内访问一般 |
| **阿里云 OSS / 腾讯云 COS** | 几元/月 | 传 `dist/` 开静态托管 | 国内访问最快，**绑域名需备案** |

无论哪家，产物都是 `dist/`，命令只有一条：

```bash
node test.mjs && node pack.mjs
```

---

## 四、发布前检查

```bash
node build-data.mjs     # 数据重建成 js/data.js
node test.mjs           # 应输出「全部通过」，当前 27966 项
node pack.mjs           # dist/ 里应有 index.html、404.html、favicon.svg、robots.txt、css/、js/
```

`dist/` 里不需要 `data/`、`preview/`、构建脚本——`pack.mjs` 只拷上线必需的 10 个文件。

---

## 五、常见问题

**改了数据，线上没变？**
Actions 没跑成功的话，看仓库 **Actions** 标签页的日志；本地先 `node test.mjs` 过一遍。

**页面 404？**
GitHub Pages 的项目站地址是 `https://<账号>.github.io/<仓库>/`，注意结尾的仓库名；`dist/` 要作为**根**上传，不是 `dist/dist/`。

**样式没更新？**
`index.html` 里资源带 `?v=104`，改完 css/js 把这个数字 +1，浏览器才会取新文件。
