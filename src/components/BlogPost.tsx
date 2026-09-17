import { useMemo, useEffect, useRef, useState } from 'react';
import { useSite } from '../hooks/useSite';
import { renderMarkdown, readingTime } from '../markdown';
import Comments from './Comments';
import Giscus from './Giscus';

/** 「复制 AI 部署指令」按钮：把一段写给本地 AI 的自然语言部署指令复制到剪贴板 */
function DeployCopyButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('复制此部署指令，粘贴给你的 AI：', prompt);
    }
  };
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={copy}
        className="border border-line px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-cyan hover:text-cyan"
      >
        {copied ? '✓ 已复制' : '复制 AI 部署指令'}
      </button>
      <details className="mt-2">
        <summary className="cursor-pointer font-mono text-[10px] text-muted hover:text-cyan">
          预览指令内容
        </summary>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-line bg-void/60 p-3 font-mono text-[10px] leading-relaxed text-slate-300">
          {prompt}
        </pre>
      </details>
    </div>
  );
}

const TRACK_URL = '/api/track';
function track(slug: string, action: 'view' | 'read', duration = 0) {
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify({ slug, action, duration })], { type: 'application/json' });
    navigator.sendBeacon(TRACK_URL, blob);
  } else {
    fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug, action, duration }),
      keepalive: true,
    }).catch(() => {});
  }
}

export default function BlogPost({ slug }: { slug: string }) {
  const { posts, settings, syncing } = useSite();
  const published = useMemo(
    () =>
      posts
        .filter((p) => p.published)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [posts],
  );

  const index = published.findIndex((p) => p.slug === slug);
  const post = index >= 0 ? published[index] : undefined;

  // 正文里若包含与封面相同的图片，剔除避免重复展示
  const bodyForRender = useMemo(() => {
    if (!post?.cover) return post?.body ?? '';
    return (post?.body ?? '')
      .split('\n')
      .filter((line) => {
        const m = line.match(/^!\[[^\]]*\]\([^)\s]+\)\s*$/);
        return !(m && m[1] === post.cover);
      })
      .join('\n');
  }, [post?.body, post?.cover]);

  // 访问统计埋点：进入记 view，离开按停留时长记 read
  const startRef = useRef(Date.now());
  useEffect(() => {
    if (!post) return;
    startRef.current = Date.now();
    track(post.slug, 'view');
    const onHide = () => {
      const dur = Math.round((Date.now() - startRef.current) / 1000);
      if (dur >= 5) track(post.slug, 'read', dur);
    };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      const dur = Math.round((Date.now() - startRef.current) / 1000);
      if (dur >= 5) track(post.slug, 'read', dur);
      window.removeEventListener('pagehide', onHide);
    };
  }, [post?.slug]);
  const minutes = readingTime(post?.body ?? '');
  const [copied, setCopied] = useState(false);
  // 文章不存在/未发布：在全部 hooks 之后统一 early return（避免 hooks 顺序不一致）
  if (!post) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
        <p className="text-muted">文章不存在或未发布</p>
        <a href="/blog" className="btn-neon mt-6 inline-block">
          返回博客
        </a>
      </div>
    );
  }
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/blog/${post.slug}`
      : '';
  const shareImg = post.cover || 'https://www.otscup.com/og-cover.png';
  const shareTitle = post.title;
  const shareNative = async () => {
    const url = `${window.location.origin}/blog/${post.slug}`;
    const isMobile =
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
    if (navigator.share && isMobile) {
      try {
        await navigator.share({ title: post.title, text: `${post.title} — OTSCUP`, url });
      } catch {
        /* 用户取消，忽略 */
      }
    } else {
      // 桌面端系统分享面板体验差（Windows 常为空面板/转圈），直接复制链接
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        window.prompt('复制此链接：', url);
      }
    }
  };
  const sameAuthor = published.filter((p) => p.author === post.author);
  const saIndex = sameAuthor.findIndex((p) => p.slug === slug);
  const older = saIndex + 1 < sameAuthor.length ? sameAuthor[saIndex + 1] : undefined;
  const newer = saIndex - 1 >= 0 ? sameAuthor[saIndex - 1] : undefined;

  // 相关文章：同作者内，同标签优先，否则取最新
  const related = sameAuthor
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({
      p,
      score: p.tags.filter((t) => post.tags.includes(t)).length,
    }))
    .sort((a, b) => b.score - a.score || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, 5)
    .map((x) => x.p);

  return (
    <div className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* 主列：竖排正文 */}
        <article className="min-w-0">
          <a
            href="/blog"
            className="font-mono text-xs text-muted transition-colors hover:text-cyan"
          >
            ← 返回博客
          </a>

          <div className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <time dateTime={post.date}>{post.date}</time>
            <span aria-hidden="true">·</span>
            <span>{minutes} 分钟阅读</span>
            <span aria-hidden="true">·</span>
            <span>创作于 {post.date}</span>
          </div>

          <h1 className="mt-4 break-words font-display text-3xl font-bold text-slate-100 sm:text-4xl">
            {post.title}
          </h1>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-line px-2 py-0.5 font-mono text-xs text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {post.cover && (
            <div className="mt-6 border border-line">
              <img
                src={post.cover}
                alt={`${post.title} 封面图`}
                className="aspect-[2/1] w-full object-cover"
              />
            </div>
          )}

          <div
            className="prose-cyber mt-8 max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(bodyForRender) }}
          />

          <footer className="mt-12 border-t border-line pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div>
                {older && (
                  <a
                    href={`/blog/${older.slug}`}
                    className="group block"
                    aria-label={`上一篇：${older.title}`}
                  >
                    <span className="font-mono text-xs text-muted">← 上一篇</span>
                    <span className="mt-1 block break-words text-sm text-slate-200 transition-colors group-hover:text-cyan">
                      {older.title}
                    </span>
                  </a>
                )}
              </div>
              <div className="sm:text-right">
                {newer && (
                  <a
                    href={`/blog/${newer.slug}`}
                    className="group block"
                    aria-label={`下一篇：${newer.title}`}
                  >
                    <span className="font-mono text-xs text-muted">下一篇 →</span>
                    <span className="mt-1 block break-words text-sm text-slate-200 transition-colors group-hover:text-cyan">
                      {newer.title}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </footer>

          {/* 一键分享 */}
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            <span className="font-mono text-xs text-muted">分享：</span>
            <button
              type="button"
              onClick={shareNative}
              className="border border-cyan/50 px-3 py-1.5 font-mono text-xs text-cyan transition-colors hover:bg-cyan hover:text-void"
            >
              {copied ? '✓ 已复制' : '分享'}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="border border-line px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-cyan hover:text-cyan"
            >
              Twitter / X
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              className="border border-line px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-cyan hover:text-cyan"
            >
              Facebook
            </a>
            <a
              href={`https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}&pic=${encodeURIComponent(shareImg)}`}
              target="_blank"
              rel="noreferrer"
              className="border border-line px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-cyan hover:text-cyan"
            >
              微博
            </a>
          </div>

          {/* AI 自动部署（仅配置了 deploy 的文章显示） */}
          {post?.deploy && (post.deploy.agentPrompt || post.deploy.cloudflareUrl) && (
            <div className="mt-6 rounded border border-cyan/30 bg-cyan/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-wider text-cyan">🚀 一键部署 / AI 自动部署</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                不会配环境？复制下面的指令，粘贴给你的本地 AI（Claude Code / Codex / ChatGPT），它会替你在你电脑上自动部署。
              </p>
              {post.deploy.cloudflareUrl && (
                <a
                  href={post.deploy.cloudflareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block border border-cyan/50 px-3 py-1.5 font-mono text-xs text-cyan transition-colors hover:bg-cyan hover:text-void"
                >
                  直接部署到 Cloudflare →
                </a>
              )}
              {post.deploy.agentPrompt && <DeployCopyButton prompt={post.deploy.agentPrompt} />}
            </div>
          )}

          {settings.commentsEnabled !== false &&
            (settings.commentsRepo &&
            settings.giscusRepoId &&
            settings.giscusCategoryId ? (
              <Giscus
                repo={settings.commentsRepo}
                repoId={settings.giscusRepoId}
                category={settings.giscusCategory || 'Announcements'}
                categoryId={settings.giscusCategoryId}
                slug={post.slug}
              />
            ) : (
              <Comments slug={post.slug} />
            ))}
        </article>

        {/* 侧栏：相关文章 + 全部文章（各自独立卡片，均排除当前篇） */}
        <aside className="space-y-6 lg:pt-16">
          <div className="cyber-card sticky top-24 p-5">
            <h3 className="section-label mb-3">相关文章</h3>
            <ul className="space-y-3">
              {related
                .filter((p) => p.slug !== post.slug)
                .map((p) => (
                  <li key={p.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                    <a
                      href={`/blog/${p.slug}`}
                      className="block break-words font-body text-sm text-slate-300 transition-colors hover:text-cyan"
                    >
                      {p.title}
                    </a>
                    <p className="mt-0.5 font-mono text-[10px] text-line">
                      <time dateTime={p.date}>{p.date}</time>
                    </p>
                  </li>
                ))}
            </ul>
          </div>

          <div className="cyber-card sticky top-24 p-5">
            <h3 className="section-label mb-3">全部文章</h3>
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {sameAuthor
                .filter((p) => p.slug !== post.slug)
                .map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/blog/${p.slug}`}
                      className="block break-words font-body text-sm text-slate-300 transition-colors hover:text-cyan"
                    >
                      {p.title}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
