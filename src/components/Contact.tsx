import { useSite } from '../hooks/useSite';

/** 邮箱图标（24x24 viewBox，描边风格） */
const MAIL_PATH =
  'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z M4 7l8 6 8-6';

/** 统一联系方式卡片：图标 + 名称 + 账号，固定尺寸，邮箱与社交平台一致 */
function ContactCard({
  href,
  name,
  handle,
  icon,
  external,
}: {
  href: string;
  name: string;
  handle: string;
  icon: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      aria-label={name}
      className="cyber-card group flex items-center gap-3 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan/40 hover:shadow-neon"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan/30 bg-cyan/5 text-cyan transition-colors group-hover:border-cyan/60 group-hover:text-magenta">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d={icon} />
        </svg>
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-mono text-[10px] uppercase tracking-[0.25em] text-magenta">
          {name}
        </span>
        <span className="block truncate font-display text-sm font-semibold text-slate-100 transition-colors group-hover:text-cyan">
          {handle}
        </span>
      </span>
    </a>
  );
}

export default function Contact() {
  const { profile, socials } = useSite();
  // 只显示已填写链接的社交平台
  const activeSocials = socials.filter((s) => s.href.trim() !== '');

  // 合并邮箱与社交，统一成等长的图标卡片网格
  const items = [
    ...profile.contacts.map((c) => ({
      key: c.label,
      href: c.href ?? '',
      name: c.label,
      handle: c.value,
      icon: MAIL_PATH,
    })),
    ...activeSocials.map((s) => ({
      key: s.name,
      href: s.href,
      name: s.name,
      handle: s.handle,
      icon: s.icon,
      external: true as const,
    })),
  ];

  return (
    <section id="contact" className="mx-auto max-w-6xl px-6 py-24">
      <p className="section-label">// 建立连接</p>
      <h2 className="font-display text-3xl font-bold text-slate-100 sm:text-4xl">
        有项目想聊聊？<span className="text-cyan neon-text">随时找我</span>
      </h2>
      <p className="mt-4 max-w-lg font-body text-muted">
        无论是移动端开发、Web 全栈还是 AI 应用集成，欢迎直接联系。
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <ContactCard
            key={it.key}
            href={it.href}
            name={it.name}
            handle={it.handle}
            icon={it.icon}
            {...('external' in it ? { external: true } : {})}
          />
        ))}
      </div>

      <p className="mt-6 font-mono text-xs tracking-wide text-muted">
        邮箱通常在 24 小时内回复 · 工作日内响应更快
      </p>
    </section>
  );
}
