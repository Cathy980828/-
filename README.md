# IR 投稿决策台

一个零依赖的本地网页工具，给国际关系 / 国际政治方向的研究生、博士生做投稿决策。

当前版本重点解决 4 件事：

- 根据稿件主题、方法、篇幅和语言状态，给出中文核心 / SSCI 推荐。
- 判断哪些期刊更适合当前作者处境，哪些只是冲刺项。
- 提醒格式和现实门槛上的主要短板，避免一开始就把稿子写死在单一期刊格式里。
- 保存不同稿件版本和不同轮次的投稿判断，形成可持续使用的个人工作台。

## 适用人群

默认更贴近这类作者：

- 国内读博
- 有中文核心 / SSCI 毕业要求
- 对中文国际关系类期刊生态不完全熟悉
- 没有或很少有 SSCI 发表经验
- 希望先做“决策和筛选”，再做精细改稿

## 直接使用

方法一：直接双击打开 [index.html](/Users/caiyue/Documents/New project/index.html)

方法二：如果你更习惯本地服务，在当前目录运行：

```bash
python3 -m http.server 8000
```

然后访问 `http://127.0.0.1:8000`

## 给别人访问

这套工具当前是纯静态网页，不依赖后端，最适合先部署成公开网页给朋友试用。

可选方式：

- `Netlify`：支持直接拖拽整个项目文件夹上线，也支持连 Git 仓库自动更新
- `Vercel`：适合后续继续加接口、数据库、登录
- `GitHub Pages`：最轻量，但更适合纯静态演示版

部署说明见 [DEPLOY.md](/Users/caiyue/Documents/New project/DEPLOY.md)。

当前项目已经补齐 `Vercel` 所需配置：

- [vercel.json](/Users/caiyue/Documents/New project/vercel.json)
- [scripts/build-static.sh](/Users/caiyue/Documents/New project/scripts/build-static.sh)
- [.gitignore](/Users/caiyue/Documents/New project/.gitignore)

导入 Vercel 后会自动把可公开访问的静态文件构建到 `dist/`，不会把说明文档一起发布出去。

## 现在多了什么

除了推荐期刊，当前版本还支持：

- 保存稿件版本到本地稿件库
- 记录某一次分析的投稿判断
- 回载旧稿件重新分析
- 回载历史判断，继续推进改稿

这些数据都保存在浏览器本地存储里，不需要账号。

## 你会看到什么

工具会输出：

- 中文首投建议
- SSCI 首投建议
- 英文冲刺项
- 自动识别到的主题画像
- 每本期刊的题材贴合度、现实可行度、格式准备度
- 当前最该先补的格式 / 篇幅 / 语言短板
- 本地稿件库
- 投稿记录

## 已内置的期刊种子数据

中文刊：

- 世界经济与政治
- 国际政治研究
- 外交评论
- 国际论坛
- 国际观察
- 当代亚太

英文刊：

- International Affairs
- The Chinese Journal of International Politics
- International Relations of the Asia-Pacific
- The Pacific Review
- Global Society
- Contemporary Politics
- International Politics

## 数据边界

这是一个决策辅助工具，不是官方投稿系统，也不直接判断论文学术价值。

当前版本的数据来源分三层：

- 期刊官网 / 出版社页面
- 编辑部或投稿系统公开说明
- 社区经验整理

其中“博士独作是否友好”“是否更现实”这类信息，本质上是经验判断，不等于官方硬规则。

## 产品化路线

产品落地路线已整理在 [PRODUCT_ROADMAP.md](/Users/caiyue/Documents/New project/PRODUCT_ROADMAP.md)。

## 后续最值得继续加的功能

1. 导入 Word 文稿后自动抽取标题、摘要、关键词和参考文献
2. 对接更多国际关系 / 政治学中文刊与英文 SSCI 期刊
3. 按期刊要求生成格式改稿清单
4. 允许你维护投稿状态，比如“首投 / 已拒 / 改投中”
5. 把“官方要求”和“社区经验”拆成两个权重视图

## 本地检查

如果你要在本地先确认 Vercel 构建产物，可运行：

```bash
sh scripts/build-static.sh
```

构建完成后，最终对外发布的文件会在 `dist/`。
