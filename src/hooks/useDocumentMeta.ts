import { useEffect } from 'react';

type MetaOptions = {
  title: string;
  description?: string;
  /** 社交分享图，绝对地址或 dataURL */
  image?: string;
  /** article 用于文章页，website 用于其它 */
  type?: 'website' | 'article';
};

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * 动态维护页面标题与社交分享元信息。
 * 静态托管无服务端渲染，爬虫抓不到这些运行时标签，
 * 但对浏览器标签页、书签与支持 JS 的抓取器有效。
 */
export function useDocumentMeta({ title, description, image, type = 'website' }: MetaOptions) {
  useEffect(() => {
    document.title = title;

    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }

    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta(
      'meta[name="twitter:card"]',
      'name',
      'twitter:card',
      image ? 'summary_large_image' : 'summary',
    );

    // dataURL 过长，不适合作为分享图；空图回退到全站封面，保证社交分享必有预览图
    const OG_FALLBACK = 'https://www.otscup.com/og-cover.png';
    const img = image && !image.startsWith('data:') ? image : OG_FALLBACK;
    setMeta('meta[property="og:image"]', 'property', 'og:image', img);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', img);
    setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
    setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630');

    setMeta('meta[property="og:url"]', 'property', 'og:url', window.location.href);
  }, [title, description, image, type]);
}
