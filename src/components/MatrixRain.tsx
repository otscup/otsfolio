import { useEffect, useRef } from 'react';

const KEY = 'cyber-fx-enabled';

/** 读取/写入特效总开关（localStorage，默认关闭——首次访问不打扰） */
export function getFxEnabled(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v === null ? false : v === '1';
  } catch {
    return false;
  }
}
export function setFxEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** 赛博矩阵雨背景：Canvas 实现。
 *  始终运行（装饰性、低干扰）；尊重用户手动开关与系统减少动效设置
 *  （仅在两者都要求降级时才放慢，而非完全关闭，保证页面不死寂）。 */
export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fxOff = (() => {
      try {
        return localStorage.getItem(KEY) === '0';
      } catch {
        return false;
      }
    })();
    // 系统减少动效 + 用户未手动开 → 降速运行
    const slow = reduce && !fxOff;

    const chars = 'アイウエオカキクケコサシスセソ0123456789ABCDEF<>[]{}/\\=+*'.split('');
    const fontSize = 14;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;
    const frameGap = slow ? 110 : 55; // slow 模式 ~9fps

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(window.innerWidth / fontSize);
      drops = Array.from({ length: cols }, () => Math.random() * -50);
    };

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < frameGap) return;
      last = t;

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.fillStyle = 'rgba(7,7,15,0.22)';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < cols; i++) {
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        const ch = chars[(Math.random() * chars.length) | 0];
        ctx.fillStyle = Math.random() > 0.975 ? 'rgba(255,0,160,.85)' : 'rgba(0,240,255,.55)';
        ctx.fillText(ch, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);

    const onFxChange = () => {
      const off = (() => {
        try {
          return localStorage.getItem(KEY) === '0';
        } catch {
          return false;
        }
      })();
      if (off) {
        cancelAnimationFrame(raf);
        raf = 0;
        canvas.style.opacity = '0';
      } else {
        canvas.style.opacity = '0.35';
        if (!raf) raf = requestAnimationFrame(draw);
      }
    };
    window.addEventListener('storage', onFxChange);
    window.addEventListener('fx-change', onFxChange);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('storage', onFxChange);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.35]"
    />
  );
}
