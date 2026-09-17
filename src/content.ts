/** 站点内容集中管理：改文案只动这个文件 */

export const profile = {
  name: 'OTS',
  title: '全栈开发者',
  tagline: '移动端原生 · Web 全栈 · AI 应用集成',
  intro:
    '专注把复杂需求落成可用产品。从 Android 原生 Canvas 图形引擎，到 Cloudflare 边缘全栈应用，独立完成设计、开发与部署。',
  /** 公开联系方式：只保留邮箱，避免电话/QQ 被爬取 */
  contacts: [
    { label: '邮箱', value: 'admin@atproxy.eu.org', href: 'mailto:admin@atproxy.eu.org' },
  ],
};

export type Social = {
  /** 平台名 */
  name: string;
  /** 展示用的账号/标识 */
  handle: string;
  href: string;
  /** 内联 SVG path，24x24 viewBox */
  icon: string;
};

/**
 * 社交平台：把 href 填成你的真实主页即可显示。
 * 留空 href 的条目会自动隐藏，方便按需启用。
 */
export const socials: Social[] = [
  {
    name: 'Telegram',
    handle: '@yourhandle',
    href: '',
    icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-.6-.396-.208-.615.13-.968.887-.918 2.24-2.328 2.406-2.52.06-.07.113-.207-.056-.207-.213 0-.485.155-.79.35-.573.366-2.077 1.376-2.336 1.545-.13.084-.256.13-.4.13-.15 0-.32-.05-.52-.13-.398-.16-1.13-.4-1.13-.4-.4-.13-.4-.4.13-.66l6.4-2.6c.4-.13.7-.2.9-.2z',
  },
  {
    name: 'YouTube',
    handle: '@yourchannel',
    href: '',
    icon: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    name: 'GitHub',
    handle: '@yourname',
    href: '',
    icon: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12',
  },
];


export type Project = {
  name: string;
  subtitle: string;
  desc: string;
  tags: string[];
  highlights: string[];
  link?: string;
  status: '已上线' | '开发中';
  accent: 'cyan' | 'magenta' | 'lime';
};

export const projects: Project[] = [
  {
    name: '乡墅通量尺宝',
    subtitle: 'Android 原生测量标注工具',
    desc:
      '面向自建房场景的现场量尺与标注 App。自研 Canvas 标注引擎与 Matrix 手势系统，替代早期 WebView 方案，解决了缩放精度与触摸响应不可靠的问题。',
    tags: ['Kotlin', 'Canvas 2D', 'MediaStore', '手势矩阵'],
    highlights: [
      '自研 Matrix 手势缩放/平移，标注坐标零漂移',
      '三 Tab 工作流：拍照 → 标注 → 项目管理',
      '真机验证的相机链路（MediaStore Uri 写入）',
    ],
    status: '开发中',
    accent: 'cyan',
  },
  {
    name: '答题挑战',
    subtitle: 'AI 出题的在线答题应用',
    desc:
      '深色金调的答题竞技应用，四视图流转，含排行榜与昵称系统。接入大模型自动生成题目，并设计了多模型 failover 保证出题不中断。',
    tags: ['Cloudflare Pages', 'AI 集成', 'Serverless', '多模型容灾'],
    highlights: [
      'AI 自动出题 + 多模型故障转移',
      '排行榜与昵称持久化',
      '部署于 Cloudflare 边缘网络，零服务器成本',
    ],
    link: 'https://question.otscup.com',
    status: '已上线',
    accent: 'magenta',
  },
  {
    name: '赛博朋克作品集',
    subtitle: '本站 · 边缘全栈个人站',
    desc:
      '你正在看的这个站点。React + Vite + Cloudflare Pages 构建，含博客系统与 AI 协作发布。内容存 D1、图片存 R2，零服务器成本；博客由 Hermes 协助维护。',
    tags: ['React', 'Cloudflare Pages', 'D1 / R2', 'Tailwind', 'Markdown'],
    highlights: [
      '赛博朋克视觉：矩阵雨 + 霓虹辉光 + 光标跟随',
      '博客系统：Markdown 编辑、XSS 防护、Giscus 评论',
      '内容云端化：D1 存储 + R2 图床，多端一致',
    ],
    link: 'https://www.otscup.com',
    status: '已上线',
    accent: 'cyan',
  },
];

export const skills = [
  { group: '移动端', items: ['Kotlin', 'Android SDK', 'Canvas 图形', '手势交互'] },
  { group: '前端', items: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'] },
  { group: '边缘 / 后端', items: ['Cloudflare Pages', 'Pages Functions', 'D1 / KV', 'REST API'] },
  { group: 'AI 工程', items: ['大模型 API 集成', 'Prompt 设计', '多模型容灾', 'Agent 编排'] },
];

export type NavItem = {
  id: string;
  label: string;
  /** 独立路由项（如博客）用 route，其余为页内锚点 */
  route?: string;
};

export const nav: NavItem[] = [
  { id: 'blog', label: '博客', route: '/blog' },
  { id: 'hero', label: '首页' },
  { id: 'about', label: '关于' },
  { id: 'projects', label: '作品' },
  { id: 'timeline', label: '历程' },
  { id: 'skills', label: '技能' },
  { id: 'contact', label: '联系' },
];

export type TimelineItem = {
  period: string;
  title: string;
  desc: string;
  tags: string[];
  current?: boolean;
};

/** 技术历程，从近到远 */
export const timeline: TimelineItem[] = [
  {
    period: '进行中',
    title: '乡墅通量尺宝 · 原生标注引擎',
    desc:
      '弃用 WebView 方案，改为 Kotlin + Canvas 自研标注引擎与 Matrix 手势系统，解决缩放精度与触摸响应问题，并在三星真机上打通相机链路。',
    tags: ['Kotlin', 'Canvas', '真机调试'],
    current: true,
  },
  {
    period: '近期',
    title: '答题挑战 · AI 出题上线',
    desc:
      '接入大模型自动生成题目，设计多模型 failover 机制避免单点故障；部署至 Cloudflare Pages，零服务器成本稳定运行。',
    tags: ['AI 集成', 'Cloudflare', 'Serverless'],
  },
  {
    period: '持续',
    title: 'Agent 编排与自动化工作流',
    desc:
      '把多个 AI 编码工具编排成协作流水线：统一设计契约、并行分派任务、代码审查后集成，用自动化替代重复劳动。',
    tags: ['Agent 编排', 'CLI 自动化', '工程规范'],
  },
  {
    period: '基础',
    title: 'Web 全栈与边缘计算',
    desc:
      '从传统前后端到边缘函数，掌握 React 生态与 Cloudflare Workers/D1/KV，偏好轻量、可控、低成本的技术选型。',
    tags: ['React', 'TypeScript', 'Edge'],
  },
];

