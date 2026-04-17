# 对外部署说明

## 结论

当前这套工具已经可以做成“朋友可访问的网页版本”。

因为它现在是：

- 纯前端静态网页
- 不依赖数据库
- 不依赖登录系统
- 推荐逻辑全部在浏览器里运行

这意味着你不需要先开发后端，就可以把它发成一个公开链接。

## 最适合你的第一阶段方案

建议先做：

`静态部署 + 浏览器本地存储`

这套方案的特点：

- 你的朋友可以直接打开链接使用
- 每个人都能录入自己的文章信息
- 每个人的数据默认只保存在自己的浏览器里
- 你不用先处理账号、权限、云数据库和隐私合规

这很适合：

- 你先给同学、朋友、小范围博士生试用
- 快速验证“这个工具到底有没有人反复用”

## 目前还不能直接做到的事

当前版本虽然已经能公开访问，但还没有做：

- 直接上传 `.docx` 后自动提取标题、摘要、关键词
- 用户注册 / 登录
- 云端保存稿件
- 多设备同步
- 你作为管理员查看大家的使用数据

所以“朋友把文章扔进去”这句话，目前更准确地说是：

- 他们可以把题目、摘要、关键词、篇幅手动填进去
- 还不能直接上传 Word 自动解析

## 部署路径

### 方案 A：Netlify

适合你现在就要发链接给别人。

优点：

- 上线最快
- 支持直接拖拽整个项目目录部署
- 后续也能接 Git 自动更新

大致步骤：

1. 注册并登录 Netlify
2. 打开 [Netlify Create deploys](https://docs.netlify.com/deploy/create-deploys/)
3. 直接把 `/Users/caiyue/Documents/New project` 整个文件夹拖进去
4. 部署完成后会生成一个公开网址
5. 把这个网址发给朋友即可

适用结论：

- 如果你只是想先让别人访问，这是最快的方案

## 方案 B：Vercel

适合你准备继续把它做成正式产品。

优点：

- 静态站点也能直接部署
- 后续加接口、数据库、登录会更顺
- Git 驱动的更新流程比较清晰

大致步骤：

1. 把项目放到 GitHub 仓库
2. 登录 Vercel
3. 导入这个仓库
4. 保持默认配置直接部署
5. 以后每次推送代码都会自动更新网页

参考：

- [Vercel deployments overview](https://vercel.com/docs/deployments/overview)
- [Vercel CLI deploy](https://vercel.com/docs/cli/deploy)

适用结论：

- 如果你准备继续开发，这是我更推荐的方案

#### 这个项目已经补好的 Vercel 配置

你当前仓库里已经有：

- [vercel.json](/Users/caiyue/Documents/New project/vercel.json)
- [scripts/build-static.sh](/Users/caiyue/Documents/New project/scripts/build-static.sh)

作用分别是：

- `vercel.json`：告诉 Vercel 构建命令、发布目录和基础响应头
- `scripts/build-static.sh`：只把真正需要上线的静态文件复制到 `dist/`

这样做的好处是：

- 公开站点不会把 `README.md`、路线图等内部文档一起暴露出去
- 以后继续加前端文件时，部署边界更清楚

#### 建议的 Vercel 上线步骤

1. 把当前目录初始化并推到 GitHub
2. 在 Vercel 里 `Add New Project`
3. 选择这个 GitHub 仓库
4. Framework Preset 保持 `Other`
5. Vercel 会读取 [vercel.json](/Users/caiyue/Documents/New project/vercel.json) 里的：
   - `buildCommand`: `sh scripts/build-static.sh`
   - `outputDirectory`: `dist`
6. 点击部署

如果你想先在本地确认构建结果，可先运行：

```bash
sh scripts/build-static.sh
```

然后检查 `dist/` 目录里是否只有：

- `index.html`
- `app.js`
- `journals.js`
- `styles.css`

## 方案 C：GitHub Pages

适合纯静态展示版。

优点：

- 成本低
- 适合项目主页或演示站

限制：

- 对后续产品化支持不如 Vercel / Netlify 灵活

参考：

- [GitHub Pages documentation](https://docs.github.com/pages)

## 你现在该怎么选

如果你的目标是：

- `这周就给朋友试用`

选 `Netlify`

如果你的目标是：

- `后面继续做成真实产品`

选 `Vercel`

## 什么时候必须上后端

当你要实现下面这些能力时，就不能只靠静态网页了：

- 用户登录
- 云端保存稿件
- 不同设备同步
- 投稿记录长期保存
- 期刊库在线更新
- 你后台查看用户反馈
- 上传 Word 后在服务端解析

这时建议的结构是：

- 前端：当前网页继续保留
- 后端：用户、稿件、分析记录、期刊规则
- 数据库：Postgres 或 Supabase
- 文件存储：上传的 Word / PDF

## 推荐的产品化顺序

1. 先部署静态版，让朋友能访问
2. 再加浏览器内 `.docx` 导入
3. 再决定是否加登录和云端保存

## 当前项目里你要发出去的文件

核心入口：

- [index.html](/Users/caiyue/Documents/New project/index.html)
- [app.js](/Users/caiyue/Documents/New project/app.js)
- [journals.js](/Users/caiyue/Documents/New project/journals.js)
- [styles.css](/Users/caiyue/Documents/New project/styles.css)

如果用静态部署，以上文件一起上传即可。
