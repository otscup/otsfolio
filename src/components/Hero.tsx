import { useSite } from '../hooks/useSite';

export default function Hero() {
  const { profile } = useSite();
  return (
    <section id="hero" className="relative flex min-h-screen items-center px-6">
      {/* 背景光斑 */}
      <div className="pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 rounded-full bg-cyan/10 blur-[100px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-magenta/10 blur-[100px]" />

      <div className="mx-auto w-full max-w-6xl">
        <p className="section-label animate-flicker">// 系统已就绪</p>

        <h1
          className="glitch font-display text-5xl font-black leading-none tracking-tight text-cyan neon-text sm:text-7xl lg:text-8xl"
          data-text="OTSCUP"
        >
          OTSCUP
        </h1>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px w-12 bg-gradient-to-r from-cyan to-transparent" />
          <h2 className="font-display text-xl font-bold tracking-wide text-slate-100 sm:text-2xl">
            {profile.title}
          </h2>
        </div>

        <p className="mt-3 font-mono text-sm tracking-wider text-magenta sm:text-base">
          {profile.tagline}
        </p>

        <p className="mt-8 max-w-xl font-body text-base leading-relaxed text-slate-300 sm:text-lg">
          {profile.intro}
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <a href="/projects" className="btn-neon">
            查看作品
          </a>
          <a
            href="/blog"
            className="btn-neon border-cyan/60 text-cyan hover:bg-cyan hover:text-void hover:shadow-neon"
          >
            查看博客
          </a>
          <a
            href="/#contact"
            className="btn-neon border-magenta/60 text-magenta hover:bg-magenta hover:shadow-neon-magenta"
          >
            联系我
          </a>
        </div>
      </div>

      {/* 滚动提示 */}
      <div className="absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 animate-float">
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted">SCROLL</span>
      </div>
    </section>
  );
}
