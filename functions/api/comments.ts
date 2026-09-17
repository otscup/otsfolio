interface Env {
  portfolio_content: D1Database;
}

const SALT = 'cyber-portfolio-v2';

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** 读取站点设置（与 content.ts 同库） */
async function readSettings(env: Env): Promise<Record<string, unknown>> {
  const r = await env.portfolio_content
    .prepare('SELECT data FROM site WHERE id = ?')
    .bind('1')
    .first<{ data: string }>();
  if (!r?.data) return {};
  try {
    return (JSON.parse(r.data) as { settings?: Record<string, unknown> }).settings || {};
  } catch {
    return {};
  }
}

/** 统计文本中 ![alt](url) 图片数量 */
function countImages(text: string): number {
  const re = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;
  return (text.match(re) || []).length;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  await env.portfolio_content
    .prepare(
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'approved'
      )`,
    )
    .run()
    .catch(() => {});

  // 读取评论
  if (method === 'GET' && url.pathname === '/api/comments') {
    const slug = (url.searchParams.get('slug') || '').trim();
    if (!slug) return json({ ok: false, error: '缺少 slug' }, 400);
    const rows = await env.portfolio_content
      .prepare('SELECT id, slug, name, body, created_at FROM comments WHERE slug = ? AND status = ? ORDER BY created_at ASC')
      .bind(slug, 'approved')
      .all<{ id: number; slug: string; name: string; body: string; created_at: number }>();
    return json({ ok: true, comments: rows.results });
  }

  // 提交评论（带验证码）
  if (method === 'POST' && url.pathname === '/api/comments') {
    let body: { slug?: string; name?: string; body?: string; captchaToken?: string; captcha?: string };
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: '格式错误' }, 400);
    }
    const slug = (body.slug || '').trim();
    const name = (body.name || '').toString().trim().slice(0, 40) || '匿名访客';
    const text = (body.body || '').toString().trim().slice(0, 2000);
    const token = (body.captchaToken || '').trim();
    const code = (body.captcha || '').trim().toUpperCase();

    if (!slug) return json({ ok: false, error: '缺少 slug' }, 400);
    if (text.length < 1) return json({ ok: false, error: '评论内容不能为空' }, 400);
    if (!token || !code) return json({ ok: false, error: '请填写验证码' }, 400);

    // 评论总开关
    const settings = await readSettings(env);
    if (settings.commentsEnabled === false) {
      return json({ ok: false, error: '评论已关闭' }, 403);
    }

    // 校验验证码（从 D1 captcha 表）
    const cap = await env.portfolio_content
      .prepare('SELECT code, expires FROM captcha WHERE token = ?')
      .bind(token)
      .first<{ code: string; expires: number }>();
    if (!cap) return json({ ok: false, error: '验证码已失效，请刷新' }, 400);
    if (cap.expires < Date.now()) return json({ ok: false, error: '验证码已过期，请刷新' }, 400);
    if (cap.code !== code) return json({ ok: false, error: '验证码错误' }, 400);
    await env.portfolio_content.prepare('DELETE FROM captcha WHERE token = ?').bind(token).run(); // 用完即删

    // 每篇文章最大评论数
    const maxPer = Number(settings.maxCommentsPerPost || 0);
    if (maxPer > 0) {
      const cnt = await env.portfolio_content
        .prepare('SELECT COUNT(*) c FROM comments WHERE slug = ? AND status = ?')
        .bind(slug, 'approved')
        .first<{ c: number }>();
      if (cnt && cnt.c >= maxPer) {
        return json({ ok: false, error: `本篇文章评论已达上限（${maxPer} 条）` }, 429);
      }
    }

    // 每条评论最大图片数
    const maxImg = Number(settings.maxImagesPerComment || 0);
    if (maxImg > 0) {
      const imgCount = countImages(text);
      if (imgCount > maxImg) {
        return json({ ok: false, error: `每条评论最多 ${maxImg} 张图片` }, 400);
      }
    }

    // 10 秒限流
    const last = await env.portfolio_content
      .prepare('SELECT created_at FROM comments WHERE status=? ORDER BY created_at DESC LIMIT 1')
      .bind('approved')
      .first<{ created_at: number }>();
    if (last && Date.now() - last.created_at < 10000) {
      return json({ ok: false, error: '太快了，稍等几秒再发' }, 429);
    }

    const now = Date.now();
    const r = await env.portfolio_content
      .prepare('INSERT INTO comments (slug, name, body, created_at, status) VALUES (?, ?, ?, ?, ?)')
      .bind(slug, name, text, now, 'approved')
      .run();
    const id = (r.meta as any)?.last_row_id ?? null;

    // 新评论通知：读评论数据 + 站点标题，组装消息后推 TG（异步，不影响响应）
    void notifyNewComment(env, slug, name, text, now).catch(() => {});

    return json({ ok: true, comment: { id, slug, name, body: text, created_at: now } });
  }

  return json({ ok: false, error: 'not found' }, 404);
};

/** 新评论推送 Telegram。失败静默（不打断评论提交流程）。 */
async function notifyNewComment(
  env: Env,
  slug: string,
  name: string,
  body: string,
  _createdAt: number,
): Promise<void> {
  try {
    const settings = await readSettings(env);
    // 开关：未显式关闭即视为开启（兼容旧数据未带此字段）
    if (settings.commentNotifyEnabled === false) return;

    const token = (settings.tgBotToken || '').toString().trim();
    let chatIds: string[] = [];
    if (Array.isArray(settings.tgChatIds)) chatIds = (settings.tgChatIds as string[]).map(String);
    else if (settings.tgChatId) chatIds = [String(settings.tgChatId)];
    if (!token || chatIds.length === 0) return;

    // 取文章标题（从 site.data.posts 里按 slug 匹配）
    let title = slug;
    try {
      const r = await env.portfolio_content
        .prepare('SELECT data FROM site WHERE id = ?').bind('1').first<{ data: string }>();
      if (r?.data) {
        const posts = (JSON.parse(r.data) as { posts?: { slug: string; title: string }[] })?.posts || [];
        const found = posts.find((p) => p.slug === slug);
        if (found) title = found.title;
      }
    } catch {
      /* 取不到标题就用 slug */
    }

    const excerpt = body.length > 120 ? body.slice(0, 120) + '…' : body;
    const siteUrl = (settings.siteTitle || 'OTSCUP');
    const tgText =
      `🆕 <b>新评论</b>\n` +
      `文章：${title}\n` +
      `来自：${name}\n` +
      `内容：${escapeHtml(excerpt)}\n` +
      `链接：https://www.otscup.com/blog/${slug}`;

    for (const cid of chatIds) {
      try {
        const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ chat_id: cid, text: tgText, parse_mode: 'HTML' }),
        });
        // 静默吞错：通知失败不影响评论提交
        void tg;
      } catch {
        /* ignore */
      }
    }
    void siteUrl;
  } catch {
    /* ignore */
  }
}

/** 极简 HTML 转义，避免评论里 <b> 等标签破坏 Telegram HTML 解析 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
