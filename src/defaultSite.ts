import type { SiteData } from './types';
import { SITE_VERSION } from './types';
import { profile, socials, projects, timeline, skills } from './content';

/** 生成一张赛博风封面图（内联 SVG → data URI，不依赖网络） */
function cover(title: string, sub: string, c1: string, c2: string): string {
  const lines = Array.from({ length: 15 }, (_, i) => {
    const x = i * 80;
    const y = i * 40;
    return `<line x1="${x}" y1="0" x2="${x}" y2="600" stroke="${c1}" stroke-width="1.5" opacity="0.22"/>` +
           `<line x1="0" y1="${y}" x2="1200" y2="${y}" stroke="${c1}" stroke-width="1.5" opacity="0.22"/>`;
  }).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" viewBox="0 0 1200 600">` +
      `<rect width="1200" height="600" fill="#07070f"/>` +
      lines +
      `<circle cx="1000" cy="150" r="160" fill="none" stroke="${c2}" stroke-width="3" opacity="0.7"/>` +
      `<circle cx="1000" cy="150" r="80" fill="${c1}" opacity="0.22"/>` +
      `<rect x="70" y="200" width="640" height="200" rx="6" fill="none" stroke="${c1}" stroke-width="2.5" opacity="0.75"/>` +
      `<text x="100" y="300" font-family="monospace" font-size="76" font-weight="bold" fill="#e2e8f0">${title}</text>` +
      `<text x="100" y="360" font-family="monospace" font-size="34" fill="${c1}">${sub}</text>` +
      `<text x="100" y="545" font-family="monospace" font-size="26" fill="${c2}">// OTS</text>` +
    `</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const coverA = cover('Canvas', '原生标注引擎', '#00f0ff', '#ff00a0');
const coverB = cover('AI Failover', '多模型容错', '#ff00a0', '#00f0ff');

/** 首次访问或数据损坏时使用的初始内容，来源于 content.ts */
export const defaultSite: SiteData = {
  version: SITE_VERSION,
  profile: {
    name: profile.name,
    title: profile.title,
    tagline: profile.tagline,
    intro: profile.intro,
    contacts: profile.contacts.map((c) => ({
      label: c.label,
      value: c.value,
      href: c.href ?? '',
    })),
  },
  socials: socials.map((s) => ({ ...s })),
  projects: projects.map((p, i) => ({
    id: `p${i + 1}`,
    name: p.name,
    subtitle: p.subtitle,
    desc: p.desc,
    tags: [...p.tags],
    highlights: [...p.highlights],
    link: p.link,
    status: p.status,
    accent: p.accent,
    featured: i < 2,
  })),
  timeline: timeline.map((t, i) => ({
    id: `t${i + 1}`,
    period: t.period,
    title: t.title,
    desc: t.desc,
    tags: [...t.tags],
    current: t.current,
  })),
  skills: skills.map((s, i) => ({
    id: `s${i + 1}`,
    group: s.group,
    items: [...s.items],
  })),
  posts: [
    {
      id: 'w1',
      slug: 'native-canvas-over-webview',
      title: '为什么我把 WebView 方案换成了原生 Canvas',
      excerpt:
        '做量尺宝的标注功能时，我先用 WebView 走了一段弯路。dpr 缩放与触摸事件的不可靠，最终逼我回到 Kotlin 原生 Canvas。',
      cover: coverA,
      body: `做「乡墅通量尺宝」的图形标注时，我最初选了 WebView 方案——毕竟 Web 技术栈熟，画布库现成，迭代快。

结果踩了两个坑，最后不得不整体重写。

![技术选型对比](${coverA})

## 坑一：dpr 缩放不可靠

不同设备的 \`devicePixelRatio\` 表现不一致，导致标注坐标在高分屏上偏移。我尝试过手动补偿：

\`\`\`kotlin
val scale = resources.displayMetrics.density
canvas.scale(scale, scale)
\`\`\`

但 WebView 内部还有自己的一层缩放，两层叠加后误差会累积。测量工具最忌讳的就是坐标不准。

## 坑二：触摸事件丢失

多指手势在 WebView 里偶发丢事件，尤其是快速缩放时。这在测量场景下是致命的——用户以为标好了，实际偏了几个像素。

> 工具类应用的核心是可信。一旦用户不信你的测量结果，功能再多也没意义。

## 换成原生 Canvas

最终用 Kotlin 重写，自己实现 Matrix 手势系统：

- 坐标变换全程自己掌控，无隐藏缩放层
- \`onTouchEvent\` 直接拿原始事件，不丢帧
- 性能反而更好，复杂图形也不卡

代价是开发量翻倍，手势逻辑得自己写。但换来的是**可预测的行为**——这在工具类应用里值得。

## 教训

技术选型要看**核心指标**能不能保住。快速迭代很重要，但如果方案在核心指标上有不确定性，早换比晚换便宜。`,
      tags: ['Android', 'Canvas', '技术选型'],
      date: '2026-07-20',
      published: true,
      author: 'ots',
    },
    {
      id: 'w2',
      slug: 'multi-model-failover',
      title: 'AI 出题的多模型 failover：别让单点故障毁掉体验',
      excerpt:
        '答题挑战接入大模型自动出题后，我遇到的第一个问题不是质量，而是稳定性。推理模型返回 content=null 让我踩了一跤。',
      cover: coverB,
      body: `给「答题挑战」接 AI 出题时，我以为难点在提示词，实际难点在**稳定性**。

![多模型回退架构](${coverB})

## 第一次踩坑：content 是 null

我最初选了一个推理型模型，本地测试没问题，上线后偶发返回空内容。排查发现推理模型会把内容放在 \`reasoning\` 字段，\`content\` 直接是 \`null\`：

\`\`\`js
const content = data.choices[0].message.content; // null
\`\`\`

## 解法：模型白名单 + 逐级回退

我改成维护一个候选列表，逐个尝试直到成功：

1. 首选快速指令模型
2. 失败则换备用模型
3. 全部失败则回退到本地题库

关键是**每一层都要真的能兜住**，而不是层层抛错。

## 部署在 Cloudflare 的额外好处

Pages Functions 天然分布式，出题请求就近处理。零服务器成本，免费额度对个人项目完全够用。

> 免费不是重点，重点是不用管运维。

## 小结

接入 AI 的工程量，八成在容错而非调用本身。`,
      tags: ['AI 集成', 'Cloudflare', '容错设计'],
      date: '2026-08-02',
      published: true,
      author: 'ots',
    },
    {
      id: 'w3',
      slug: 'site-launch-cyber-portfolio',
      title: '开站公告：这个赛博朋克作品集是怎么搭起来的',
      excerpt:
        '从零到上线，一个 React + Vite + Cloudflare Pages 的个人站点。聊聊架构、特效、博客系统和部署，以及后面的更新计划。',
      cover: coverB,
      body: `这是本站的第一篇正式文章，也算开站公告。

![作品集首页](${coverB})

## 技术栈

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS
- **部署**：Cloudflare Pages（免费额度，零服务器）
- **特效**：矩阵雨背景、光标光斑、滚动进度，全部尊重系统「减少动态」设置
- **博客**：自写轻量 Markdown 解析（34 项单测覆盖 XSS 防护），支持封面图与正文插图

## 为什么自己写 Markdown 解析

博客是高频更新的模块，第三方库要么太重要么不控安全。自己写一版只支持需要的语法（标题/列表/引用/代码/图片/链接），顺便把 \`javascript:\`、\`onerror\` 这类注入挡在渲染层之外，测试覆盖 34 个用例。

## 内容管理

后台用浏览器本地存储（localStorage）直接管理文章、项目、时间线，无需数据库。部署到云端后会把存储层换成 Cloudflare D1 + R2，组件代码零改动。

## 接下来

- 后台登录加 Cloudflare Turnstile 真人验证
- 文章页接 Giscus 评论（基于 GitHub Discussions，零自建后端）
- 我会持续在这里写技术笔记和工程复盘

> 这个站也是我的「实验田」——想到什么就发上来。`,
      tags: ['工程', 'Cloudflare', '站点公告'],
      date: '2026-08-14',
      published: true,
      author: 'hermes',
    },
    {
      id: 'w4',
      slug: 'build-cost-breakdown',
      title: '建这个作品集到底花了多少钱',
      excerpt:
        '纯静态站 + 免费额度的时代，搭建成本几乎为零。这篇把时间、工具和隐性成本摊开算给你看。',
      cover: coverA,
      body: `经常有人问：做一个像样的个人作品集要多少钱？我把这个站的账摊开。

## 直接金钱成本：0 元

| 项目 | 费用 | 说明 |
| --- | --- | --- |
| 域名 | ¥0（暂用 pages.dev 子域） | 绑定自有域名另算，约 ¥60/年 |
| 托管 | ¥0 | Cloudflare Pages 免费额度够个人站 |
| 评论系统 | ¥0 | Giscus 基于 GitHub Discussions |
| 真人验证 | ¥0 | Cloudflare Turnstile 免费额度 |
| 素材图 | ¥0 | 封面用内联 SVG 生成，不买图库 |

> 如果已有 Cloudflare 账号，整个站上线**现金支出为零**。

## 时间成本（隐性）

| 阶段 | 估时 |
| --- | --- |
| 脚手架与视觉系统 | 约半天 |
| 特效与首页 | 约半天 |
| 博客系统（含 Markdown/XSS/后台） | 约 1 天 |
| 排版与图片问题排查 | 约半天 |
| 部署与验证 | 约 2 小时 |

合计**约 3 个工作日**，其中大半花在「排版细节」和「特效可见性」这类体验打磨上，而不是功能本身。

## AI 协作的成本

本站大量代码由 AI 协作完成（自然语言驱动 + 自主验证渲染）。这类协作本身按订阅计费，不计入项目现金流，但显著压缩了时间成本——尤其是浏览器自动化截图验证那部分，省掉了我来回手动刷新的功夫。

## 结论

- **想上线一个作品集**：今天就能免费做出来
- **想做得好看**：成本在审美和细节，不在钱
- **想长期维护**：把博客写成习惯，比一次砸钱重要

这就是「总价」。`,
      tags: ['成本', '工程', '复盘'],
      date: '2026-08-14',
      published: true,
      author: 'hermes',
    },
  ],
  settings: {
    siteTitle: 'OTSCUP — 全栈开发者作品集',
    siteDescription:
      '全栈开发者 OTSCUP 的作品集与技术博客。移动端原生、Web 全栈、AI 应用集成。',
    // 空值表示未设置口令，后台会提示设置
    adminPassHash: '',
    // 自建 D1 评论系统默认配置
    commentsEnabled: true,
    maxCommentsPerPost: 200,
    maxImagesPerComment: 3,
    maxImageSizeKB: 512,
    // AI 助手 / 评论通知默认配置（密钥留空，后台填入后生效）
    aihubKey: '',
    aiBaseUrl: 'https://aihub.071129.xyz/v1',
    aiModels: 'tencent/hy3:free,inclusionai/ling-3.0-flash:free,openrouter/free,openai/gpt-oss-20b:free',
    commentNotifyEnabled: true,
  },
};
