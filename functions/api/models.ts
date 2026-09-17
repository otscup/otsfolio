interface Env { portfolio_content: D1Database; }

/** 从 D1 读取站点 settings（API key + base url） */
async function getSettings(env: Env): Promise<{
  key: string | null;
  base: string;
}> | null {
  try {
    const r: any = await env.portfolio_content
      .prepare('SELECT data FROM site WHERE id = ?').bind('1').first();
    if (!r?.data) return null;
    const data = JSON.parse(r.data);
    const s = data?.settings || {};
    const key = (s.aihubKey || '').trim() || null;
    let base = (s.aiBaseUrl || '').trim() || 'https://aihub.071129.xyz/v1';
    base = base.replace(/\/+$/, '');
    return { key, base };
  } catch {
    return null;
  }
}

/** GET /api/models — 拉取 AI API 可用模型列表（需管理员鉴权） */
export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);

  // 仅 GET
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (url.pathname !== '/api/models') {
    return new Response(JSON.stringify({ ok: false, error: 'not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 管理员鉴权：检查 x-admin-hash
  try {
    const raw = await env.portfolio_content
      .prepare('SELECT data FROM site WHERE id = ?').bind('1').first<{ data: string }>();
    if (raw?.data) {
      const stored = (JSON.parse(raw.data) as { settings?: { adminPassHash?: string } })
        ?.settings?.adminPassHash;
      const h = request.headers.get('x-admin-hash');
      if (stored && h !== stored) {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'server error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 获取 API 配置
  const cfg = await getSettings(env);
  if (!cfg || !cfg.key) {
    return new Response(JSON.stringify({ ok: false, error: 'AI 后端未配置，请先填入 API Key' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    // 调用 OpenAI 兼容的 /models 端点
    const apiUrl = `${cfg.base}/models`;
    const r = await fetch(apiUrl, {
      method: 'GET',
      headers: { authorization: `Bearer ${cfg.key}` },
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return new Response(
        JSON.stringify({
          ok: false,
          error: `API 返回 ${r.status}${errText ? ': ' + errText.slice(0, 200) : ''}`,
        }),
        { status: 502, headers: { 'content-type': 'application/json' } },
      );
    }

    const j: any = await r.json();
    // 兼容多种返回格式
    const models: string[] = (j.data || j.models || []).map((m: any) =>
      typeof m === 'string' ? m : m.id || m.model || '',
    ).filter(Boolean);

    return new Response(
      JSON.stringify({ ok: true, models, count: models.length }),
      { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: `请求失败: ${e?.message || e}` }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }
};
