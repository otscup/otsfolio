import { useEffect, useState } from 'react';
import type { SiteData } from '../types';
import { loadSite, syncFromCloud } from '../store';

/** 前台读取站点内容；后台保存后自动刷新，并优先同步云端（D1） */
export type SiteView = SiteData & { syncing: boolean };

export function useSite(): SiteView {
  const [site, setSite] = useState<SiteData>(() => loadSite());
  // syncing 表示「云端数据尚未拉回」：纯云端文章（如自动生成的博客）在数据
  // 就绪前若直接渲染会误显示「文章不存在」，且 JSON-LD 无法注入。Googlebot
  // 早期快照可能抓到空壳，故同步未完成时文章页应显示 loading 而非错误态。
  const [syncing, setSyncing] = useState<boolean>(true);

  useEffect(() => {
    const refresh = () => setSite(loadSite());
    // 同页保存
    window.addEventListener('site-updated', refresh);
    // 跨标签页保存
    window.addEventListener('storage', refresh);
    // 启动时从云端（D1）拉取最新内容覆盖本地缓存
    syncFromCloud().then((ok) => {
      if (ok) refresh();
      setSyncing(false);
    });
    return () => {
      window.removeEventListener('site-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return { ...site, syncing };
}
