import { useEffect, useState } from 'react';
import { getFxEnabled, setFxEnabled } from './MatrixRain';

/** 右下角特效开关：用户可随时关闭/恢复装饰性动效 */
export default function FxToggle() {
  const [on, setOn] = useState(() => getFxEnabled());

  useEffect(() => {
    setFxEnabled(on);
    // 通知其它标签页/组件
    window.dispatchEvent(new Event('fx-change'));
  }, [on]);

  return (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      aria-pressed={on}
      title={on ? '关闭特效' : '开启特效'}
      className="fixed bottom-4 left-4 z-[60] flex h-9 w-9 items-center justify-center border border-line bg-void/80 font-mono text-xs text-muted backdrop-blur-sm transition-colors hover:border-cyan hover:text-cyan"
    >
      {on ? 'FX' : '··'}
    </button>
  );
}
