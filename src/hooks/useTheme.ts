import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

const KEY = 'otscup-theme';

function readStored(): Theme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'dark' || s === 'light' || s === 'system') return s;
  } catch { /* */ }
  return 'system';
}

/** 应用主题到 <html>（不读 storage，只按 theme 值设置） */
function applyToDom(theme: Theme) {
  const html = document.documentElement;
  html.classList.remove('light', 'dark');
  if (theme === 'light') {
    html.classList.add('light');
  } else if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    // system: 跟随系统
    const light = window.matchMedia('(prefers-color-scheme: light)').matches;
    html.classList.add(light ? 'light' : 'dark');
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(readStored);

  // 切换主题时应用 + 持久化
  useEffect(() => {
    applyToDom(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* */ }
  }, [theme]);

  // system: 监听系统偏好变化实时切换
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      const html = document.documentElement;
      html.classList.toggle('light', mq.matches);
      html.classList.toggle('dark', !mq.matches);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return [theme, setTheme];
}
