#!/usr/bin/env node
/**
 * OTSCUP MCP Server
 * 让 Claude Desktop / Cursor 等 MCP 客户端直接管理 otscup.com 文章。
 *
 * 工具列表：
 *   list_posts      - 列出所有文章（返回 id/slug/title/date/published）
 *   get_post        - 获取单篇文章完整内容（按 slug 或 id）
 *   create_post     - 新建文章（title, slug, body, tags?, excerpt?, cover?）
 *   update_post     - 更新文章（slug, 任意字段）
 *   delete_post     - 删除文章（slug 或 id）
 *   list_models     - 拉取可用 AI 模型
 *   get_site_info   - 站点概览（文章数/项目数/settings）
 *
 * 认证：通过 x-admin-hash（与后台同一密码）或公开读接口（list/get 不需鉴权）
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createHash } from 'crypto';

// ---------- 配置 ----------
const SITE_BASE = process.env.OTSCUP_SITE || 'https://www.otscup.com';
const ADMIN_PASS = process.env.OTSCUP_ADMIN_PASS || '';
const PROXY = process.env.OTSCUP_PROXY || null; // 可选代理

function adminHash() {
  // sha256('cyber-portfolio-v2' + password)
  if (!ADMIN_PASS) return '';
  return createHash('sha256').update('cyber-portfolio-v2' + ADMIN_PASS).digest('hex');
}

// ---------- HTTP 工具 ----------
async function httpGet(path) {
  const url = SITE_BASE + path;
  const r = await fetch(url, { method: 'GET', headers: { 'User-Agent': 'OTSCUP-MCP/1.0' } });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}: ${await r.text().catch(() => '')}`);
  return r.json();
}

async function httpPut(path, data) {
  const url = SITE_BASE + path;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'x-admin-hash': adminHash(),
      'User-Agent': 'OTSCUP-MCP/1.0',
    },
    body: JSON.stringify({ data }),
  });
  if (!r.ok) throw new Error(`PUT ${path} -> ${r.status}: ${await r.text().catch(() => '')}`);
  return r.json();
}

async function getSiteData() {
  const r = await httpGet('/api/content');
  return r.data || r;
}

// ---------- 创建 MCP Server ----------
const server = new McpServer({
  name: 'otscup-site',
  version: '1.0.0',
});

// 工具 1：列出文章
server.registerTool(
  'list_posts',
  {
    description: '列出 otscup.com 所有文章。返回每篇的 id/slug/title/date/published。无需鉴权。',
    inputSchema: {},
  },
  async () => {
    const data = await getSiteData();
    const posts = (data.posts || []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      date: p.date,
      published: p.published,
      author: p.author,
    }));
    return {
      content: [{
        type: 'text',
        text: `共 ${posts.length} 篇文章：\n` + JSON.stringify(posts, null, 2),
      }],
    };
  }
);

// 工具 2：获取单篇
server.registerTool(
  'get_post',
  {
    description: '获取单篇文章的完整内容（按 slug 或 id）。无需鉴权。',
    inputSchema: {
      slug: z.string().optional().describe('文章 slug（URL 标识符），如 multi-model-failover'),
      id: z.string().optional().describe('文章 id，如 w1 或 auto-20260818'),
    },
  },
  async ({ slug, id }) => {
    if (!slug && !id) throw new Error('需要提供 slug 或 id');
    const data = await getSiteData();
    const post = (data.posts || []).find((p) =>
      (slug && p.slug === slug) || (id && p.id === id)
    );
    if (!post) throw new Error('文章未找到');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(post, null, 2),
      }],
    };
  }
);

// 工具 3：新建文章
server.registerTool(
  'create_post',
  {
    description: '新建一篇文章并发布到 otscup.com。需要管理员口令。',
    inputSchema: {
      title: z.string().describe('文章标题'),
      slug: z.string().describe('URL slug（英文短横线分隔），如 my-new-post'),
      body: z.string().describe('Markdown 正文'),
      tags: z.array(z.string()).optional().describe('标签数组'),
      excerpt: z.string().optional().describe('摘要（不填则取正文前 80 字）'),
      cover: z.string().optional().describe('封面图 URL 或 data: URI'),
    },
  },
  async ({ title, slug, body, tags, excerpt, cover }) => {
    const data = await getSiteData();
    // 检查 slug 唯一
    if ((data.posts || []).some((p) => p.slug === slug)) {
      throw new Error(`slug "${slug}" 已存在`);
    }
    const id = `auto-${Date.now()}`;
    const newPost = {
      id,
      slug,
      title,
      excerpt: excerpt || body.slice(0, 80).replace(/\n/g, ' '),
      cover: cover || '',
      body,
      tags: tags || [],
      date: new Date().toISOString().slice(0, 10),
      published: true,
      author: 'mcp',
    };
    data.posts.push(newPost);
    await httpPut('/api/content', data);
    return {
      content: [{
        type: 'text',
        text: `文章已创建并发布：${title}（slug: ${slug}）\nURL: ${SITE_BASE}/blog/${slug}`,
      }],
    };
  }
);

// 工具 4：更新文章
server.registerTool(
  'update_post',
  {
    description: '更新已有文章的任意字段（title/body/tags/excerpt/cover/published）。需管理员口令。',
    inputSchema: {
      slug: z.string().describe('要更新的文章 slug'),
      title: z.string().optional(),
      body: z.string().optional(),
      tags: z.array(z.string()).optional(),
      excerpt: z.string().optional(),
      cover: z.string().optional(),
      published: z.boolean().optional(),
    },
  },
  async ({ slug, ...updates }) => {
    const data = await getSiteData();
    const post = (data.posts || []).find((p) => p.slug === slug);
    if (!post) throw new Error(`slug "${slug}" 未找到`);
    Object.assign(post, updates);
    await httpPut('/api/content', data);
    return {
      content: [{
        type: 'text',
        text: `文章已更新：${post.title}（slug: ${slug}）`,
      }],
    };
  }
);

// 工具 5：删除文章
server.registerTool(
  'delete_post',
  {
    description: '删除一篇文章（按 slug 或 id）。需管理员口令。',
    inputSchema: {
      slug: z.string().optional(),
      id: z.string().optional(),
    },
  },
  async ({ slug, id }) => {
    if (!slug && !id) throw new Error('需要 slug 或 id');
    const data = await getSiteData();
    const before = data.posts.length;
    data.posts = data.posts.filter((p) =>
      !((slug && p.slug === slug) || (id && p.id === id))
    );
    if (data.posts.length === before) throw new Error('文章未找到');
    await httpPut('/api/content', data);
    return {
      content: [{
        type: 'text',
        text: `已删除（slug=${slug || '-'}, id=${id || '-'}）。剩余 ${data.posts.length} 篇。`,
      }],
    };
  }
);

// 工具 6：可用 AI 模型
server.registerTool(
  'list_models',
  {
    description: '拉取 otscup.com 后台配置的可用 AI 模型列表。',
    inputSchema: {},
  },
  async () => {
    const r = await fetch(`${SITE_BASE}/api/models`, {
      headers: { 'x-admin-hash': adminHash(), 'User-Agent': 'OTSCUP-MCP/1.0' },
    });
    if (!r.ok) throw new Error(`models -> ${r.status}`);
    const j = await r.json();
    return {
      content: [{
        type: 'text',
        text: `可用模型 ${j.count} 个：\n` + JSON.stringify(j.models, null, 2),
      }],
    };
  }
);

// 工具 7：站点概览
server.registerTool(
  'get_site_info',
  {
    description: '获取 otscup.com 站点概览：文章数、项目数、settings 字段。',
    inputSchema: {},
  },
  async () => {
    const data = await getSiteData();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          posts: data.posts?.length || 0,
          projects: data.projects?.length || 0,
          skills: data.skills?.length || 0,
          timeline: data.timeline?.length || 0,
          socials: data.socials?.length || 0,
          settings_keys: Object.keys(data.settings || {}),
          profile: data.profile,
        }, null, 2),
      }],
    };
  }
);

// ---------- 启动 ----------
const transport = new StdioServerTransport();
await server.connect(transport);
