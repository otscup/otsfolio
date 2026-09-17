import { useMemo } from 'react';
import BlogShell from './BlogShell';
import BlogPost from './BlogPost';
import SeoJsonLd from './SeoJsonLd';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useSite } from '../hooks/useSite';

export default function BlogPostPage({ slug }: { slug: string }) {
  const { posts, settings } = useSite();
  const post = useMemo(
    () => posts.find((p) => p.slug === slug && p.published),
    [posts, slug],
  );

  // 文章页 SEO：标题/描述随文章变化（修复所有文章共享站名标题的问题）
  useDocumentMeta(
    post
      ? {
          title: `${post.title} — OTSCUP`,
          description: post.excerpt || settings.siteDescription,
          image: 'https://www.otscup.com/og-cover.png',
          type: 'article',
        }
      : { title: settings.siteTitle },
  );

  const jsonLd = useMemo(() => {
    if (!post) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.excerpt || settings.siteDescription,
      datePublished: post.date,
      dateModified: post.date,
      author: {
        '@type': 'Person',
        name: post.author === 'ots' ? 'OTS' : 'Hermes',
      },
      publisher: {
        '@type': 'Person',
        name: 'OTS',
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `https://www.otscup.com/blog/${post.slug}`,
      },
      image: 'https://www.otscup.com/og-cover.png',
    };
  }, [post, settings.siteDescription]);

  return (
    <BlogShell>
      {jsonLd && <SeoJsonLd data={jsonLd} />}
      <BlogPost slug={slug} />
    </BlogShell>
  );
}

