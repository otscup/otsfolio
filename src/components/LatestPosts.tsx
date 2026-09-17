import { useSite } from '../hooks/useSite';
import { autoExcerpt, readingTime } from '../markdown';

/** 首页的最新文章预览，引导访客进入博客。竖排、带封面图。 */
export default function LatestPosts() {
  const { posts } = useSite();
  const latest = [...posts]
    .filter((p) => p.published)
    .sort((a, b) => {
      // 有封面的优先展示（提升视觉吸引力），其次按日期倒序
      const ca = a.cover ? 1 : 0;
      const cb = b.cover ? 1 : 0;
      if (ca !== cb) return cb - ca;
      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);

  if (latest.length === 0) return null;

  return (
    <section id="latest" className="mx-auto max-w-3xl px-6 py-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label">// 最近在想</p>
          <h2 className="font-display text-3xl font-bold text-slate-100 sm:text-4xl">
            博客<span className="text-cyan neon-text">文章</span>
          </h2>
        </div>
        <a href="/blog" className="font-mono text-xs text-cyan transition-colors hover:text-magenta">
          查看全部 →
        </a>
      </div>

      {/* 竖排：一排一个内容 */}
      <div className="mt-10 flex flex-col gap-6">
        {latest.map((post) => (
          <a key={post.id} href={`/blog/${post.slug}`} className="group block">
            <article className="cyber-card overflow-hidden p-0 transition-transform duration-300 hover:-translate-y-1">
              {post.cover && (
                <div className="overflow-hidden border-b border-line">
                  <img
                    src={post.cover}
                    alt={`${post.title} 封面图`}
                    loading="lazy"
                    className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-6">
                <div className="flex items-center gap-3 font-mono text-xs text-muted">
                  <time dateTime={post.date}>{post.date}</time>
                  <span className="text-line">·</span>
                  <span>{readingTime(post.body)} 分钟阅读</span>
                </div>

                <h3 className="mt-3 break-words font-display text-xl font-bold text-slate-100 transition-colors group-hover:text-cyan">
                  {post.title}
                </h3>

                <p className="prose-cyber mt-3 font-body text-sm leading-relaxed text-muted">
                  {post.excerpt || autoExcerpt(post.body)}
                </p>

                {post.tags.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {post.tags.map((t) => (
                      <li
                        key={t}
                        className="border border-line px-2 py-0.5 font-mono text-[10px] text-muted"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-4 font-mono text-xs text-cyan">阅读全文 →</p>
              </div>
            </article>
          </a>
        ))}
      </div>
    </section>
  );
}
