import type { ReactNode } from 'react';
import Nav from './Nav';
import Hero from './Hero';
import About from './About';
import Projects from './Projects';
import Timeline from './Timeline';
import Skills from './Skills';
import Contact from './Contact';
import LatestPosts from './LatestPosts';
import MatrixRain from './MatrixRain';
import CursorGlow from './CursorGlow';
import ScrollProgress from './ScrollProgress';
import FxToggle from './FxToggle';
import { useReveal, revealClass } from '../hooks/useReveal';
import { useSite } from '../hooks/useSite';

/** 滚动进场包装器 */
function Reveal({ children }: { children: ReactNode }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={revealClass(shown)}>
      {children}
    </div>
  );
}

/** 公开的作品集前台 */
export default function SiteView() {
  const { profile } = useSite();
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <MatrixRain />
      <CursorGlow />
      <ScrollProgress />

      {/* 扫描线叠层 */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(180deg, rgba(0,240,255,.045) 0 1px, transparent 1px 4px)',
        }}
      />

      <Nav />

      <main className="relative z-10">
        <Hero />
        <Reveal>
          <About />
        </Reveal>
        <Reveal>
          <Projects />
        </Reveal>
        <Reveal>
          <Timeline />
        </Reveal>
        <Reveal>
          <Skills />
        </Reveal>
        <Reveal>
          <LatestPosts />
        </Reveal>
        <Reveal>
          <Contact />
        </Reveal>
      </main>

      <FxToggle />

      <footer className="relative z-10 border-t border-line py-8 text-center font-mono text-xs text-muted">
        <p>
          © {new Date().getFullYear()} {profile.name} — Built with React · Deployed on Cloudflare
        </p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <a
            href="https://github.com/otscup/otsfolio"
            target="_blank"
            rel="noreferrer"
            className="text-muted transition-colors hover:text-cyan"
          >
            GitHub ↗
          </a>
          <a
            href="/admin"
            className="text-[10px] text-line transition-colors hover:text-cyan"
            title="内容管理"
          >
            ·
          </a>
        </div>
      </footer>
    </div>
  );
}
