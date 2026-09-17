interface Env { portfolio_content: D1Database; }

const KNOWLEDGE = `你是 otscup.com（OTSCUP）站点的专属 AI 助手，专门帮助访客部署和复现本站作者的开源/可部署项目。

作者用 AI 协作完成了以下项目，你掌握它们的技术栈与常见坑：

1. 本站（赛博朋克作品集 / cyber-portfolio）
   - 技术栈：React + Vite + TypeScript + Tailwind，部署在 Cloudflare Pages；内容存 D1，图片存 R2，无服务器成本。
   - 博客系统由 Hermes 协助发布（cron 每晚 21:00 自动产出小白教程/热搜见解）。
   - 常见坑：React hooks 必须在每次渲染按相同顺序调用，不能在条件 return 之后调用 useMemo/useState（否则报 #310 invalid hook call）；Cloudflare Pages 的 Functions 用 functions/api/*.ts 编写，部署随 pages deploy 一起上传；R2 上传走 /api/upload，读取走 /api/assets/<key>。

2. otsmail（自部署全栈邮件服务）
   - 后端：Cloudflare Worker + D1 + KV + R2；安卓客户端 Jetpack Compose 原生，直连 HTTP API。
   - 功能：自填服务器域名、邮件搜索、DeepL 十种语言一键翻译、验证码自动提取一键复制。

3. 答题挑战（quiz-challenge）
   - Cloudflare Pages + AI 集成 + Serverless；AI 大模型自动出题，多模型 failover 保证出题不中断。

通用回答准则：
- 部署类问题优先给出「让本地 AI（Claude Code / Codex）自动执行」的步骤，降低小白门槛。
- 如果访客问的是某个项目的部署，先确认项目的技术栈，再给出对应的 Cloudflare Pages / Worker 步骤。
- 不知道就直说，不要编造命令或密钥。
- 回答用中文，简洁，给可直接复制的命令。`;

const DEFAULT_BASE = 'https://aihub.071129.xyz/v1';
const DEFAULT_MODELS = ['tencent/hy3:free', 'inclusionai/ling-3.0-flash:free', 'openrouter/free', 'openai/gpt-oss-20b:free'];

// 简易限速：按 IP 每分钟最多 10 次
const RATE = 10;
const WIN = 60_000;
const hits: Map<string, { n: number; ts: number }> = new Map();

/** 读取站点配置（密钥 + 模型 + base url），一次取全，避免多次查库 */
async function getConfig(env: Env): Promise<{
  key: string | null;
  base: string;
  models: string[];
} | null> {
  try {
    const r: any = await env.portfolio_content
      .prepare('SELECT data FROM site WHERE id = ?').bind('1').first();
    if (!r?.data) return null;
    const data = JSON.parse(r.data);
    const s = data?.settings || {};
    const key = (s.aihubKey || '').trim() || null;
    // base url：去掉尾部 / 后拼 /chat/completions
    let base = (s.aiBaseUrl || '').trim() || DEFAULT_BASE;
    base = base.replace(/\/+$/, '');
    if (!/\/v\d+$/.test(base) && !/chat\/completions$/.test(base)) {
      base = base.endsWith('/v1') || /\/v\d+$/.test(base) ? base : base;
    }
    const models = (s.aiModels || '')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    return { key, base, models: models.length ? models : DEFAULT_MODELS };
  } catch {
    return null;
  }
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const rec = hits.get(ip);
    if (rec && now - rec.ts < WIN) {
      if (rec.n >= RATE) {
        return new Response(JSON.stringify({ ok: false, error: '请求过于频繁，请稍后再试。' }), {
          status: 429, headers: { 'content-type': 'application/json' },
        });
      }
      rec.n += 1;
    } else {
      hits.set(ip, { n: 1, ts: now });
    }

    const cfg = await getConfig(env);
    if (!cfg || !cfg.key) {
      return new Response(JSON.stringify({ ok: false, error: 'AI 后端未配置' }), {
        status: 500, headers: { 'content-type': 'application/json' },
      });
    }

    const body: any = await request.json().catch(() => ({}));
    const msg = (body.message || '').toString().slice(0, 2000).trim();
    if (!msg) {
      return new Response(JSON.stringify({ ok: false, error: '消息为空' }), {
        status: 400, headers: { 'content-type': 'application/json' },
      });
    }

    // base 形如 https://host/v1 → 拼 /chat/completions
    const apiUrl = `${cfg.base}/chat/completions`;
    let lastErr = '';
    for (const m of cfg.models) {
      try {
        const r = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: KNOWLEDGE },
              { role: 'user', content: msg },
            ],
            max_tokens: 600,
            temperature: 0.6,
          }),
        });
        if (!r.ok) { lastErr = `${m}->${r.status}`; continue; }
        const j: any = await r.json();
        const text = j?.choices?.[0]?.message?.content?.trim();
        if (!text) { lastErr = `${m} empty`; continue; }
        return new Response(JSON.stringify({ ok: true, reply: text }), {
          headers: { 'content-type': 'application/json' },
        });
      } catch (e: any) {
        lastErr = `${m}->${e?.message || e}`;
      }
    }
    return new Response(JSON.stringify({ ok: false, error: `AI 暂时不可用（${lastErr}），请稍后再试。` }), {
      status: 502, headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: '服务器错误' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
