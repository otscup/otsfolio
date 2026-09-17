// /api/mcp - 远程 HTTP MCP Server (Streamable HTTP transport)
// 无状态 CRUD，每个请求独立处理，适合 Cloudflare Pages Functions。
// 其他电脑的 AI 客户端（Claude Desktop / Cursor / Cherry Studio）直接连 URL 即可。

interface Env {
  portfolio_content: D1Database;
  ADMIN_PASS_HASH?: string;
}

const SERVER_INFO = { name: 'otscup-site', version: '1.0.0' };
const PROTOCOL_VERSION = '2024-11-05';

// ---------- 工具定义（与本地 mcp/server.mjs 一致） ----------
const TOOLS = [
  {
    name: 'list_posts',
    description: '列出 otscup.com 所有文章。返回每篇的 id/slug/title/date/published。无需鉴权。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_post',
    description: '获取单篇文章的完整内容（按 slug 或 id）。无需鉴权。',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: '文章 slug，如 multi-model-failover' },
        id: { type: 'string', description: '文章 id，如 w1 或 auto-20260818' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_post',
    description: '新建一篇文章并发布到 otscup.com。需要管理员口令。',
    inputSchema: {
      type: 'object',
      required: ['title', 'slug', 'body'],
      properties: {
        title: { type: 'string', description: '文章标题' },
        slug: { type: 'string', description: 'URL slug（英文短横线分隔）' },
        body: { type: 'string', description: 'Markdown 正文' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
        excerpt: { type: 'string', description: '摘要（不填则取正文前 80 字）' },
        cover: { type: 'string', description: '封面图 URL 或 data: URI' },
        notify: { type: 'boolean', description: '发布后自动推送 Telegram 通知（需后台已配置 TG bot）' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_post',
    description: '更新已有文章的任意字段。需管理员口令。',
    inputSchema: {
      type: 'object',
      required: ['slug'],
      properties: {
        slug: { type: 'string', description: '要更新的文章 slug' },
        title: { type: 'string' },
        body: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        excerpt: { type: 'string' },
        cover: { type: 'string' },
        published: { type: 'boolean' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'delete_post',
    description: '删除一篇文章。需管理员口令。',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string' },
        id: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_models',
    description: '拉取 otscup.com 后台配置的可用 AI 模型列表。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_site_info',
    description: '获取 otscup.com 站点概览：文章数、项目数、settings 字段。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

// ---------- 鉴权：mcp-key 优先，admin-hash 兜底 ----------
async function getSiteData(env: Env): Promise<any> {
  const r = await env.portfolio_content
    .prepare('SELECT data FROM site WHERE id = ?')
    .bind('1')
    .first<{ data: string }>();
  return r?.data ? JSON.parse(r.data) : null;
}

/** 校验写操作鉴权。返回 'yes' | 'no-auth' | 'bad-key'。
 *  优先级：x-mcp-key（独立 API key） > x-admin-hash（后台密码） */
async function authOk(request: Request, env: Env): Promise<'yes' | 'no-auth' | 'bad-key'> {
  const data = await getSiteData(env);
  const settings = data?.settings || {};

  // 1. 优先用独立 MCP key
  const mcpKey = request.headers.get('x-mcp-key');
  if (mcpKey) {
    const keys: any[] = settings.mcpKeys || [];
    if (keys.some((k) => k.key === mcpKey)) return 'yes';
    return 'bad-key'; // 带 mcp-key 但不匹配 → 不 fallback
  }

  // 2. fallback: admin-hash
  const hash = request.headers.get('x-admin-hash');
  if (!hash) return 'no-auth';
  const stored = settings.adminPassHash;
  return !!stored && stored === hash ? 'yes' : 'no-auth';
}

// ---------- 写操作：更新 D1 ----------
async function writeSiteData(env: Env, data: any): Promise<void> {
  await env.portfolio_content
    .prepare(
      'INSERT INTO site (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
    )
    .bind('1', JSON.stringify(data), Date.now())
    .run();
}

// ---------- 工具执行器 ----------
async function executeTool(
  name: string,
  args: any,
  env: Env,
  authed: 'yes' | 'no-auth' | 'bad-key',
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  const authErr = authed === 'bad-key'
    ? '鉴权失败：x-mcp-key 无效（该 key 已被吊销或不存在）'
    : '未授权：缺少有效的 x-mcp-key 或 x-admin-hash';
  try {
    switch (name) {
      case 'list_posts': {
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        const posts = (data.posts || []).map((p: any) => ({
          id: p.id, slug: p.slug, title: p.title,
          date: p.date, published: p.published, author: p.author,
        }));
        return { content: [{ type: 'text', text: `共 ${posts.length} 篇文章：\n` + JSON.stringify(posts, null, 2) }] };
      }

      case 'get_post': {
        if (!args.slug && !args.id) return { content: [{ type: 'text', text: '需要 slug 或 id' }], isError: true };
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        const post = (data.posts || []).find((p: any) =>
          (args.slug && p.slug === args.slug) || (args.id && p.id === args.id));
        if (!post) return { content: [{ type: 'text', text: '文章未找到' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(post, null, 2) }] };
      }

      case 'create_post': {
        if (authed !== 'yes') return { content: [{ type: 'text', text: authErr }], isError: true };
        if (!args.title || !args.slug || !args.body) {
          return { content: [{ type: 'text', text: '缺少必填字段 title/slug/body' }], isError: true };
        }
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        if ((data.posts || []).some((p: any) => p.slug === args.slug)) {
          return { content: [{ type: 'text', text: `slug "${args.slug}" 已存在` }], isError: true };
        }
        const id = `auto-${Date.now()}`;
        const postDate = new Date().toISOString().slice(0, 10);
        data.posts.push({
          id, slug: args.slug, title: args.title,
          excerpt: args.excerpt || args.body.slice(0, 80).replace(/\n/g, ' '),
          cover: args.cover || '', body: args.body,
          tags: args.tags || [], date: postDate,
          published: true, author: 'mcp',
        });
        await writeSiteData(env, data);
        const postUrl = `https://www.otscup.com/blog/${args.slug}`;

        // 发文后自动推 TG（notify: true 时）
        if (args.notify === true) {
          const token = data.settings?.tgBotToken;
          let chatIds: string[] = [];
          if (Array.isArray(data.settings?.tgChatIds)) chatIds = data.settings.tgChatIds.map(String);
          else if (data.settings?.tgChatId) chatIds = [String(data.settings.tgChatId)];

          if (token && chatIds.length > 0) {
            // cover 是 data: URI 时纯文字，否则带图
            const usePhoto = args.cover && !args.cover.startsWith('data:');
            const text = `📢 新文章发布\n\n${args.title}\n${args.excerpt || ''}\n\n${postUrl}`.slice(0, 4000);
            const results: { chat: string; ok: boolean; error?: string }[] = [];
            for (const cid of chatIds) {
              try {
                const url = usePhoto
                  ? `https://api.telegram.org/bot${token}/sendPhoto`
                  : `https://api.telegram.org/bot${token}/sendMessage`;
                const payload = usePhoto
                  ? { chat_id: cid, photo: args.cover, caption: text, parse_mode: 'Markdown' }
                  : { chat_id: cid, text, parse_mode: 'Markdown' };
                const tg = await fetch(url, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json; charset=utf-8' },
                  body: JSON.stringify(payload),
                });
                const tgRes = (await tg.json()) as { ok: boolean; description?: string };
                results.push({ chat: cid, ok: tgRes.ok, error: tgRes.description });
                if (!tgRes.ok) break; // 第一个失败就停，说明 token/chat 有问题
              } catch (e) {
                results.push({ chat: cid, ok: false, error: String(e) });
                break;
              }
            }
            const allOk = results.every(r => r.ok);
            const tgStatus = allOk
              ? `TG 通知已推送（${results.length} 个会话）`
              : `TG 通知失败：${results.find(r => !r.ok)?.error || 'unknown'}`;
            return { content: [{ type: 'text', text: `文章已创建并发布：${args.title}\nURL: ${postUrl}\n${tgStatus}` }] };
          } else {
            return { content: [{ type: 'text', text: `文章已创建并发布：${args.title}\nURL: ${postUrl}\n⚠️ TG 通知跳过：后台未配置 TG bot token 或 chat id` }] };
          }
        }

        return { content: [{ type: 'text', text: `文章已创建并发布：${args.title}（slug: ${args.slug}）\nURL: ${postUrl}` }] };
      }

      case 'update_post': {
        if (authed !== 'yes') return { content: [{ type: 'text', text: authErr }], isError: true };
        if (!args.slug) return { content: [{ type: 'text', text: '缺少 slug' }], isError: true };
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        const post = (data.posts || []).find((p: any) => p.slug === args.slug);
        if (!post) return { content: [{ type: 'text', text: `slug "${args.slug}" 未找到` }], isError: true };
        const { slug, ...updates } = args;
        Object.assign(post, updates);
        await writeSiteData(env, data);
        return { content: [{ type: 'text', text: `文章已更新：${post.title}（slug: ${slug}）` }] };
      }

      case 'delete_post': {
        if (authed !== 'yes') return { content: [{ type: 'text', text: authErr }], isError: true };
        if (!args.slug && !args.id) return { content: [{ type: 'text', text: '需要 slug 或 id' }], isError: true };
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        const before = data.posts.length;
        data.posts = data.posts.filter((p: any) =>
          !((args.slug && p.slug === args.slug) || (args.id && p.id === args.id)));
        if (data.posts.length === before) return { content: [{ type: 'text', text: '文章未找到' }], isError: true };
        await writeSiteData(env, data);
        return { content: [{ type: 'text', text: `已删除（slug=${args.slug || '-'}, id=${args.id || '-'}）。剩余 ${data.posts.length} 篇。` }] };
      }

      case 'list_models': {
        const data = await getSiteData(env);
        const models = (data?.settings?.aiModels || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        return { content: [{ type: 'text', text: `可用模型 ${models.length} 个：\n` + JSON.stringify(models, null, 2) }] };
      }

      case 'get_site_info': {
        const data = await getSiteData(env);
        if (!data) return { content: [{ type: 'text', text: '站点无数据' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify({
          posts: data.posts?.length || 0,
          projects: data.projects?.length || 0,
          skills: data.skills?.length || 0,
          timeline: data.timeline?.length || 0,
          socials: data.socials?.length || 0,
          settings_keys: Object.keys(data.settings || {}),
          profile: data.profile,
        }, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `错误: ${e?.message || e}` }], isError: true };
  }
}

// ---------- JSON-RPC 请求处理器 ----------
function rpcResponse(id: any, result: any) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

async function handleRpcRequest(req: any, env: Env, authed: 'yes' | 'no-auth' | 'bad-key'): Promise<any> {
  const { id, method, params } = req;

  switch (method) {
    case 'initialize':
      return rpcResponse(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: true } },
        serverInfo: SERVER_INFO,
      });

    case 'initialized':
      return null; // 通知，无响应

    case 'tools/list':
      return rpcResponse(id, { tools: TOOLS });

    case 'tools/call': {
      const { name, arguments: args } = params || {};
      const result = await executeTool(name || '', args || {}, env, authed);
      return rpcResponse(id, result);
    }

    case 'ping':
      return rpcResponse(id, {});

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------- 主入口 ----------
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { method } = request;
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-admin-hash, x-mcp-key',
  };

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  // 只接受 POST（MCP Streamable HTTP）
  if (method !== 'POST') {
    return new Response(JSON.stringify(rpcError(null, -32600, 'Only POST supported')), {
      status: 405, headers: { ...headers, 'content-type': 'application/json', allow: 'POST' },
    });
  }

  // 解析 JSON-RPC body（支持单条或批量）
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, 'Invalid JSON')), {
      status: 400, headers: { ...headers, 'content-type': 'application/json' },
    });
  }

  // 确保 D1 表存在
  await env.portfolio_content
    .prepare('CREATE TABLE IF NOT EXISTS site (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)')
    .run().catch(() => {});

  const authed = await authOk(request, env);

  // 批量请求
  if (Array.isArray(body)) {
    const results = await Promise.all(
      body.map((req) => handleRpcRequest(req, env, authed)),
    );
    return new Response(JSON.stringify(results.filter(Boolean)), {
      headers: { ...headers, 'content-type': 'application/json' },
    });
  }

  // 单条请求
  const result = await handleRpcRequest(body, env, authed);
  if (result === null) {
    // 通知（如 initialized），返回 202 无 body
    return new Response(null, { status: 202, headers });
  }
  return new Response(JSON.stringify(result), {
    headers: { ...headers, 'content-type': 'application/json' },
  });
};
