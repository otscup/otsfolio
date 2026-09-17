import { useSite } from '../hooks/useSite';
import { useState } from 'react';
import type { Project } from '../types';

const accentMap: Record<
  Project['accent'],
  { badge: string; marker: string; tag: string; hover: string }
> = {
  cyan: {
    badge: 'border-cyan/60 text-cyan',
    marker: 'bg-cyan',
    tag: 'border-cyan/40 text-muted',
    hover: 'hover:border-cyan/60 hover:shadow-neon',
  },
  magenta: {
    badge: 'border-magenta/60 text-magenta',
    marker: 'bg-magenta',
    tag: 'border-magenta/40 text-muted',
    hover: 'hover:border-magenta/60 hover:shadow-neon-magenta',
  },
  lime: {
    badge: 'border-lime/60 text-lime',
    marker: 'bg-lime',
    tag: 'border-lime/40 text-muted',
    hover: 'hover:border-lime/60',
  },
};

export default function Projects() {
  const { projects } = useSite();
  const [showAll, setShowAll] = useState(false);
  const featuredList = projects.filter((p) => p.featured);
  const visible = showAll ? projects : featuredList;
  return (
    <section id="projects" className="mx-auto max-w-6xl px-6 py-24">
      <p className="section-label">// 作品精选</p>
      <h2 className="font-display text-3xl font-bold neon-text text-cyan sm:text-4xl">
        作品精选
      </h2>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className={
            'border px-4 py-2 font-mono text-xs transition-colors ' +
            (!showAll
              ? 'border-cyan bg-cyan/10 text-cyan'
              : 'border-line text-muted hover:border-cyan hover:text-cyan')
          }
        >
          精选作品
        </button>
        <button
          type="button"
          onClick={() => (window.location.hash = '/projects')}
          className={
            'border px-4 py-2 font-mono text-xs transition-colors ' +
            (showAll
              ? 'border-cyan bg-cyan/10 text-cyan'
              : 'border-line text-muted hover:border-cyan hover:text-cyan')
          }
        >
          全部作品
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {visible.length === 0 ? (
          <p className="col-span-full cyber-card p-8 text-center font-mono text-sm text-muted">
            暂无精选作品，前往后台「项目」勾选要展示的项目
          </p>
        ) : (
          visible.map((p) => {
          const a = accentMap[p.accent];
          const slug = p.slug || p.id;
          return (
            <article
              key={p.id}
              onClick={() => (window.location.hash = `/projects/${encodeURIComponent(slug)}`)}
              className={`cyber-card hover:-translate-y-1 active:border-cyan/50 active:shadow-neon ${a.hover} flex cursor-pointer flex-col p-6 sm:p-7`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center border px-2.5 py-1 font-mono text-xs uppercase tracking-wider ${a.badge}`}
                >
                  {p.status}
                </span>
              </div>

              {p.cover && (
                <div className="mt-4 overflow-hidden border border-line">
                  <img
                    src={p.cover}
                    alt={`${p.name} 封面`}
                    loading="lazy"
                    className="h-40 w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
              )}

              <h3 className="mt-4 font-display text-2xl font-bold">{p.name}</h3>
              <p className="mt-1 font-mono text-sm text-muted">{p.subtitle}</p>
              <p className="mt-4 text-sm leading-relaxed">{p.desc}</p>

              <ul className="mt-5 space-y-2.5">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 ${a.marker}`}
                      aria-hidden="true"
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap gap-2">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className={`border px-2 py-0.5 font-mono text-xs ${a.tag}`}
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-6 pt-1">
                {p.link ? (
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-neon inline-block"
                  >
                    查看线上
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-block cursor-not-allowed border border-line bg-surface/50 px-6 py-3 font-display text-sm uppercase tracking-wider text-muted opacity-60"
                  >
                    查看线上
                  </span>
                )}
              </div>
            </article>
          );
        })
        )}
      </div>
    </section>
  );
}
