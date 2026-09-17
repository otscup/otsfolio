import { useState, useEffect } from 'react';
import { nav } from '../content';
import { useSite } from '../hooks/useSite';
import { useTheme } from '../hooks/useTheme';

export default function Nav() {
  const { profile } = useSite();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const [hash, setHash] = useState(() => {
    const p = window.location.pathname.replace(/^\/+/, '');
    return p ? `/${p}` : (window.location.hash || '#/');
  });

  // 监听路由变化（干净 URL 用 popstate，旧 hash 用 hashchange），动态高亮当前导航项
  useEffect(() => {
    const onRoute = () => {
      const p = window.location.pathname.replace(/^\/+/, '');
      setHash(p ? `/${p}` : (window.location.hash || '#/'));
    };
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  const isActive = (n: (typeof nav)[number]) => {
    const cur = hash;
    if (n.route) return cur.startsWith(n.route); // 博客：/blog 任意子路由
    return cur === `#${n.id}` || cur === `/#${n.id}` || (n.id === 'hero' && (cur === '#/' || cur === '/' || cur === ''));
  };

  // 独立路由项（博客）优先展示，页内锚点跳过「首页」
  const items = nav.filter((n) => n.route || n.id !== 'hero');

  const hrefOf = (n: (typeof nav)[number]) => n.route ?? `/#${n.id}`;

  const linkCls = (n: (typeof nav)[number]) =>
    'font-mono text-xs uppercase tracking-widest transition-colors ' +
    (isActive(n)
      ? 'text-cyan neon-text'
      : 'text-muted hover:text-cyan');

  return (
    <header className="fixed top-0 z-40 w-full border-b border-line bg-void/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href="/"
          className="font-display text-lg font-black tracking-widest text-cyan neon-text"
        >
          {profile.name}
        </a>

        {/* 桌面导航 */}
        <nav className="hidden gap-7 md:flex" aria-label="主导航">
          {items.map((n) => (
            <a key={n.id} href={hrefOf(n)} className={linkCls(n)}>
              {n.label}
            </a>
          ))}
        </nav>

        {/* 主题切换 */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
          title={theme === 'dark' ? '深色模式 · 点击切换浅色' : theme === 'light' ? '浅色模式 · 点击切换跟随系统' : '跟随系统 · 点击切换深色'}
          aria-label="切换主题"
          className="hidden h-9 w-9 items-center justify-center border border-line text-sm transition-colors hover:border-cyan hover:text-cyan md:flex"
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'}
        </button>

        {/* 移动端汉堡按钮 */}
        <button
          type="button"
          aria-label={open ? '关闭菜单' : '打开菜单'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 flex-col items-center justify-center gap-1.5 border border-line transition-colors hover:border-cyan md:hidden"
        >
          <span
            className={`block h-px w-4 bg-cyan transition-transform ${open ? 'translate-y-[3.5px] rotate-45' : ''}`}
          />
          <span
            className={`block h-px w-4 bg-cyan transition-transform ${open ? '-translate-y-[3.5px] -rotate-45' : ''}`}
          />
        </button>
      </div>

      {/* 移动端下拉菜单 */}
      {open && (
        <nav
          className="border-t border-line bg-void/95 px-6 py-4 md:hidden"
          aria-label="移动导航"
        >
          <ul className="space-y-3">
            <li>
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
                className="font-mono text-sm uppercase tracking-widest text-muted transition-colors hover:text-cyan"
              >
                {theme === 'dark' ? '🌙 深色模式' : theme === 'light' ? '☀️ 浅色模式' : '🖥️ 跟随系统'}
              </button>
            </li>
            {items.map((n) => (
              <li key={n.id}>
                <a
                  href={hrefOf(n)}
                  onClick={() => setOpen(false)}
                  className={
                    'block font-mono text-sm uppercase tracking-widest transition-colors ' +
                    (isActive(n) ? 'text-cyan neon-text' : 'text-muted hover:text-cyan')
                  }
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
