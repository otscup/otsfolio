/**
 * 站点内容的数据契约 —— 前台渲染与后台编辑共用。
 *
 * 本地阶段：数据存在 localStorage（键 SITE_STORE_KEY）。
 * 云端阶段：同样的结构存入 Cloudflare D1，图片存 R2，
 *          只需把 loadSite/saveSite 换成 fetch('/api/content')，
 *          组件与后台 UI 完全不用改。
 */

export type Social = {
  name: string;
  handle: string;
  href: string;
  /** 内联 SVG path，24x24 viewBox */
  icon: string;
};

export type Project = {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  tags: string[];
  highlights: string[];
  link?: string;
  status: '已上线' | '开发中';
  accent: 'cyan' | 'magenta' | 'lime';
  /** 是否在前台"作品精选"区展示（勾选几个展示几个） */
  featured?: boolean;
  /** 封面图：本地阶段为 dataURL，云端阶段为 R2 公开地址 */
  cover?: string;
  /** 多图展示（成品截图/效果演示），R2 地址数组。无则不显示 */
  gallery?: string[];
  /** 详情页路由键：URL 友好，唯一。留空时回退用 id */
  slug?: string;
  /** 一键部署信息（可选）：AI 部署指令 + Cloudflare 模板链接。无则不显示 */
  deploy?: {
    /** 配套源码仓库（公开可访问） */
    repoUrl?: string;
    /** Cloudflare 一键部署模板链接（Deploy to Cloudflare） */
    cloudflareUrl?: string;
    /** 写给本地 AI 的部署指令（自然语言，AI 可直接执行） */
    agentPrompt?: string;
  };
};

export type TimelineItem = {
  id: string;
  period: string;
  title: string;
  desc: string;
  tags: string[];
  current?: boolean;
};

export type SkillGroup = {
  id: string;
  group: string;
  items: string[];
};

/** 博客文章 */
export type Post = {
  id: string;
  /** URL 短链，用于 /blog/<slug>，须唯一 */
  slug: string;
  title: string;
  /** 列表页摘要；留空则自动从正文截取 */
  excerpt: string;
  /** 正文，支持轻量 Markdown */
  body: string;
  tags: string[];
  /** ISO 日期 YYYY-MM-DD */
  date: string;
  /** 草稿不在前台显示 */
  published: boolean;
  /** 封面图：本地为 dataURL，云端为 R2 地址 */
  cover?: string;
  /** 作者：'hermes' 由 AI 协作发布，'ots' 由站长本人撰写 */
  author?: 'hermes' | 'ots';
  /** 一键部署信息（可选）：AI 部署指令 + Cloudflare 模板链接。无则不显示 */
  deploy?: {
    /** 配套源码仓库（公开可访问） */
    repoUrl?: string;
    /** Cloudflare 一键部署模板链接（Deploy to Cloudflare） */
    cloudflareUrl?: string;
    /** 写给本地 AI 的部署指令（自然语言，AI 可直接执行） */
    agentPrompt?: string;
  };
};

/** 站点设置 */
export type Settings = {
  /** 浏览器标签标题 */
  siteTitle: string;
  /** SEO 描述 */
  siteDescription: string;
  /**
   * 后台访问口令的哈希值（非明文）。
   * 空字符串表示未设置口令，此时后台开放访问并提示用户设置。
   */
  adminPassHash: string;
  /**
   * 评论系统配置。
   * - 若配置了 commentsRepo + giscusRepoId + giscusCategoryId，文章页使用 Giscus（基于 GitHub Discussions）。
   * - 否则回退到自建 D1 评论系统（Comments.tsx）。
   * commentsRepo 格式为 owner/repo，须为公开仓库且已安装 Giscus App、开启 Discussions。
   */
  commentsRepo?: string;
  /** Giscus 仓库 ID（giscus.app 配置页提供） */
  giscusRepoId?: string;
  /** Giscus 分类名（如 Announcements） */
  giscusCategory?: string;
  /** Giscus 分类 ID（giscus.app 配置页提供） */
  giscusCategoryId?: string;
  /**
   * 是否开启评论。false 时隐藏所有评论区（Giscus 与自建均不显示）。
   */
  commentsEnabled?: boolean;
  /**
   * 单篇文章最大评论数（0 或留空表示不限制）。
   */
  maxCommentsPerPost?: number;
  /**
   * 单条评论最大图片数（即 ![alt](url) 数量，0 或留空表示不限制）。
   */
  maxImagesPerComment?: number;
  /**
   * 单张图片建议大小上限（KB）。评论仅存图片链接，服务端无法校验远程图片体积，
   * 此值为前端软提示（超出仅警告，不阻断）。
   */
  maxImageSizeKB?: number;
  /**
   * Cloudflare Turnstile 站点密钥。留空则后台登录不做真人验证（仅口令）。
   */
  turnstileSiteKey?: string;
  /**
   * AI 助手 API Key。填入后前台右下角 AI 助手可用；留空则助手返回「后端未配置」。
   */
  aihubKey?: string;
  /**
   * AI 助手 API 基础地址。默认 https://aihub.071129.xyz/v1；可改为任意 OpenAI 兼容端点。
   */
  aiBaseUrl?: string;
  /**
   * AI 助手模型列表（按顺序 failover）。逗号分隔，留空用内置默认列表。
   */
  aiModels?: string;
  /**
   * 新评论 Telegram 通知开关。开启后每有新评论即推送到 tgBotToken/tgChatIds 配置的群组。
   */
  commentNotifyEnabled?: boolean;
  /**
   * Telegram Bot Token。新评论通知与发文推送共用。在 @BotFather 创建机器人获取。
   */
  tgBotToken?: string;
  /**
   * 单一 Telegram Chat ID（兼容旧数据）。新评论通知与发文推送共用。
   */
  tgChatId?: string;
  /**
   * Telegram Chat ID 列表。多个时逐个推送（新评论通知与发文推送共用）。
   */
  tgChatIds?: string[];
  /**
   * MCP API Key 列表。每个客户端一个独立 key，用于 /api/mcp 写操作鉴权。
   * key 格式: mcp_ + 32 位十六进制。
   */
  mcpKeys?: { id: string; name: string; key: string; createdAt: number; lastUsed?: number }[];
};

export type Contact = {
  label: string;
  value: string;
  href: string;
};

export type Profile = {
  name: string;
  title: string;
  tagline: string;
  intro: string;
  contacts: Contact[];
};

export type SiteData = {
  /** 数据结构版本，便于将来迁移 */
  version: number;
  profile: Profile;
  socials: Social[];
  projects: Project[];
  timeline: TimelineItem[];
  skills: SkillGroup[];
  posts: Post[];
  settings: Settings;
};

export const SITE_STORE_KEY = 'cyber-portfolio-site-v2';
/** 后台会话标记（sessionStorage，关闭标签即失效） */
export const ADMIN_SESSION_KEY = 'cyber-portfolio-admin-session';
export const SITE_VERSION = 2;
