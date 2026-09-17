/** 赛博朋克设计系统 —— 唯一配色/动效来源，禁止硬编码颜色 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#0d0d1a',        // 页面最底色（提亮，避免过黑）
        surface: '#16162e',     // 卡片底
        elevated: '#1e1e3a',    // 悬浮卡片
        cyan: '#00f0ff',        // 主霓虹
        magenta: '#ff00a0',     // 副霓虹
        lime: '#c8ff00',        // 强调/成功
        muted: '#8a8aae',        // 次级文字（提亮）
        line: '#2c2c4e',        // 描边（提亮）
      },
      fontFamily: {
        display: ['Orbitron', 'ui-sans-serif', 'sans-serif'],
        body: ['"Rajdhani"', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 12px rgba(0,240,255,.45), 0 0 36px rgba(0,240,255,.15)',
        'neon-magenta': '0 0 12px rgba(255,0,160,.45), 0 0 36px rgba(255,0,160,.15)',
        inset: 'inset 0 1px 0 rgba(255,255,255,.06)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(0,240,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,.06) 1px, transparent 1px)',
        scan: 'repeating-linear-gradient(180deg, rgba(0,240,255,.05) 0 1px, transparent 1px 4px)',
      },
      backgroundSize: { grid: '44px 44px' },
      keyframes: {
        flicker: { '0%,100%': { opacity: '1' }, '48%': { opacity: '.72' }, '52%': { opacity: '.92' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        sweep: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: {
        flicker: 'flicker 4s infinite',
        float: 'float 6s ease-in-out infinite',
        sweep: 'sweep 6s linear infinite',
      },
    },
  },
  plugins: [],
};
