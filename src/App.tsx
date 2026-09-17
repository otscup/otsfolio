import { Suspense, lazy, useEffect, useState } from 'react';
import SiteView from './components/SiteView';
import BlogListPage from './components/BlogListPage';
import BlogPostPage from './components/BlogPostPage';
import ProjectsPage from './components/ProjectsPage';
import ProjectDetail from './components/ProjectDetail';
import ChatWidget from './components/ChatWidget';
import SeoJsonLd from './components/SeoJsonLd';
import { useHashRoute } from './hooks/useHashRoute';
import { useSite } from './hooks/useSite';
import { useDocumentMeta } from './hooks/useDocumentMeta';
import { isLoggedIn } from './auth';

// 后台按需加载，不进前台首屏体积
const AdminPanel = lazy(() => import('./admin/AdminPanel'));
const AdminLogin = lazy(() => import('./admin/AdminLogin'));

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="animate-flicker font-mono text-sm text-cyan">载入中…</p>
    </div>
  );
}

/** 后台入口：先过登录闸门 */
function AdminRoute() {
  const { settings } = useSite();
  const [authed, setAuthed] = useState(() => isLoggedIn());

  // 未设置口令时直接放行，但后台会提示设置
  const needLogin = settings.adminPassHash !== '' && !authed;

  return (
    <Suspense fallback={<Loading />}>
      {needLogin ? <AdminLogin onSuccess={() => setAuthed(true)} /> : <AdminPanel />}
    </Suspense>
  );
}

export default function App() {
  const hash = useHashRoute();
  const { settings, posts } = useSite();

  // 解析路由
  const path = hash.replace(/^#\/?/, ''); // '' | 'blog' | 'blog/xxx' | 'admin'
  const isAdmin = path.startsWith('admin');
  const isBlogPost = /^blog\/.+/.test(path);
  const isBlogList = path === 'blog';
  const isProjects = path === 'projects';
  const isProjectDetail = /^projects\/.+/.test(path);
  const projectSlug = isProjectDetail ? decodeURIComponent(path.slice('projects/'.length)) : '';

  const slug = isBlogPost ? decodeURIComponent(path.slice('blog/'.length)) : '';
  const post = isBlogPost ? posts.find((p) => p.slug === slug && p.published) : undefined;

  // 页面标题与分享元信息
  const meta = isAdmin
    ? { title: '内容管理后台' }
    : isBlogPost
      ? {
          title: post ? `${post.title} — ${settings.siteTitle}` : `文章不存在 — ${settings.siteTitle}`,
          description: post?.excerpt || settings.siteDescription,
          image: post?.cover,
          type: 'article' as const,
        }
      : isBlogList
        ? { title: `博客 — ${settings.siteTitle}`, description: settings.siteDescription }
        : { title: settings.siteTitle, description: settings.siteDescription };

  useDocumentMeta(meta);

  // 全站结构化数据：非文章页注入 WebSite + Breadcrumb（文章页由 BlogPostPage 单独管 Article）
  const siteJsonLd = !isBlogPost
    ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: settings.siteTitle,
            url: 'https://www.otscup.com',
            description: settings.siteDescription,
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '首页', item: 'https://www.otscup.com' },
              ...(isBlogList
                ? [{ '@type': 'ListItem', position: 2, name: '博客', item: 'https://www.otscup.com/blog' }]
                : []),
            ],
          },
        ],
      }
    : null;

  // 路由切换后处理滚动：有锚点(#about)则滚到区块，否则回页首
  useEffect(() => {
    const anchor = window.location.hash;
    if (anchor && !anchor.startsWith('#/') && anchor.length > 1) {
      const el = document.getElementById(anchor.slice(1));
      if (el) {
        // 等首页内容渲染
        setTimeout(() => el.scrollIntoView({ behavior: 'instant' as ScrollBehavior }), 50);
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [hash]);

  // 全站访问统计：每次路由切换记一条 view（后台不统计）
  useEffect(() => {
    if (isAdmin) return;
    const routeSlug = isBlogPost
      ? slug
      : path === 'blog'
        ? 'blog'
        : path === ''
          ? 'home'
          : path.split('/')[0]; // about/projects/timeline/skills/contact
    const send = () => {
      const blob = new Blob([JSON.stringify({ slug: `page:${routeSlug}`, action: 'view' })], {
        type: 'application/json',
      });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/track', blob);
    };
    send();
  }, [hash, isAdmin, isBlogPost, slug, path]);

  if (isAdmin) return <AdminRoute />;
  if (isBlogPost) return <BlogPostPage slug={slug} />;
  if (isBlogList)
    return (
      <>
        {siteJsonLd && <SeoJsonLd data={siteJsonLd} />}
        <BlogListPage />
      </>
    );
  if (isProjectDetail) return <ProjectDetail slug={projectSlug} />;
  if (isProjects)
    return (
      <>
        {siteJsonLd && <SeoJsonLd data={siteJsonLd} />}
        <ProjectsPage />
      </>
    );
  return (
    <>
      {siteJsonLd && <SeoJsonLd data={siteJsonLd} />}
      <SiteView />
      <ChatWidget />
    </>
  );
}
