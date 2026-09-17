import { useState, useEffect } from 'react';
import { verifyPass, markLoggedIn, hashPass } from '../auth';
import { loadSite, saveSite, syncFromCloud } from '../store';

/**
 * 后台登录闸门。
 * - 未设置口令：提示先设置（仍在本地）
 * - 已设置口令：本地用 SHA-256(加盐) 哈希比对 D1 中 settings.adminPassHash
 *   与云端写接口同源，稳定且不受网络影响。
 *   注：Turnstile 真人验证因国内网络常加载失败，暂不渲染 widget；密钥仍存于设置中。
 */
export default function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [site, setSite] = useState(() => loadSite());
  // 挂载时从 D1 拉最新数据，防止 localStorage 缓存的旧 hash 导致新密码登录失败
  useEffect(() => {
    syncFromCloud().then((ok) => {
      if (ok) setSite(loadSite());
    });
  }, []);
  const hasPass = site.settings.adminPassHash !== '';

  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const doLogin = async () => {
    setBusy(true);
    setError('');
    try {
      // 本地比对 D1 口令哈希（与云端写接口同源）。云端写入接口另有 D1 哈希二次校验。
      const ok = await verifyPass(pass, site.settings.adminPassHash);
      if (!ok) setError('口令不正确');
      if (ok) {
        markLoggedIn();
        onSuccess();
      }
    } catch {
      setError('校验失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = () => void doLogin();

  const handleSetup = async () => {
    if (pass.length < 6) {
      setError('口令至少 6 位');
      return;
    }
    if (pass !== confirm) {
      setError('两次输入不一致');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const hash = await hashPass(pass);
      saveSite({ ...site, settings: { ...site.settings, adminPassHash: hash } });
      markLoggedIn();
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="section-label">// 访问控制</p>
        <h1 className="font-display text-2xl font-bold text-slate-100">
          {hasPass ? (
            <>
              后台<span className="text-cyan neon-text">登录</span>
            </>
          ) : (
            <>
              设置<span className="text-cyan neon-text">访问口令</span>
            </>
          )}
        </h1>

        {!hasPass && (
          <p className="mt-3 font-body text-sm text-muted">
            首次进入后台，请先设置口令，之后修改内容都需要验证。
          </p>
        )}

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (hasPass) void handleLogin();
            else void handleSetup();
          }}
        >
          <div>
            <label
              htmlFor="admin-pass"
              className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
            >
              {hasPass ? '访问口令' : '设置口令（至少 6 位）'}
            </label>
            <input
              id="admin-pass"
              type="password"
              autoComplete={hasPass ? 'current-password' : 'new-password'}
              autoFocus
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className="ios-input"
            />
          </div>

          {!hasPass && (
            <div>
              <label
                htmlFor="admin-pass2"
                className="mb-1.5 block font-mono text-xs tracking-wider text-muted"
              >
                再次输入
              </label>
              <input
                id="admin-pass2"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="ios-input"
              />
            </div>
          )}

          {error && (
            <p role="alert" className="font-mono text-xs text-magenta">
              ⚠ {error}
            </p>
          )}

          <button type="submit" disabled={busy || !pass} className="btn-neon w-full">
            {busy ? '处理中…' : hasPass ? '进入后台' : '设置并进入'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between font-mono text-xs">
          <a href="/" className="text-muted transition-colors hover:text-cyan">
            ← 返回前台
          </a>
          {hasPass && (
            <span className="text-line">忘记口令？清除浏览器数据即重置</span>
          )}
        </div>
      </div>
    </div>
  );
}
