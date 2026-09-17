# OTSCUP MCP 配置指南

让 Claude Desktop / Cursor / Cherry Studio 等 MCP 客户端直接管理 otscup.com 文章。

## 两种连接方式

| 方式 | 场景 | 配置复杂度 |
|------|------|-----------|
| **远程 HTTP**（推荐） | 任何电脑、任何客户端，直接连 URL | ⭐ 最简单 |
| 本地 stdio | 只在有代码的电脑本地用 | ⭐⭐ 需装依赖 |

## 方式一：远程 HTTP（推荐）

**URL**: `https://www.otscup.com/api/mcp`

其他电脑直接连这个地址即可，无需装任何依赖。

### 鉴权方式

远程 HTTP 支持两种鉴权方式（二选一）：

| 方式 | Header | 来源 | 适用场景 |
|------|--------|------|---------|
| **独立 API Key**（推荐） | `x-mcp-key` | 后台「MCP API Key 管理」生成 | 每个客户端独立 key，可单独吊销 |
| admin-hash | `x-admin-hash` | `sha256('cyber-portfolio-v2' + 后台密码)` | 无独立 key 时的兜底方案 |

> **推荐用独立 API Key**：每个客户端（Cursor/Claude Desktop/...）生成一个专属 key，吊销一个不影响其他客户端。

### 生成独立 API Key

1. 打开后台 `https://www.otscup.com/#/admin`
2. 进入「设置」标签
3. 滚动到最底部「MCP API Key 管理」区块
4. 填写客户端名称（如 "我的 Cursor"），点「生成新 Key」
5. 复制生成的 `mcp_xxxxxxxx...` 格式 key（只显示一次，关闭后无法再查看完整值）
6. 将 key 配置到客户端的 header `x-mcp-key` 中

### Claude Desktop

编辑 `claude_desktop_config.json`：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "otscup-site": {
      "url": "https://www.otscup.com/api/mcp",
      "headers": {
        "x-mcp-key": "mcp_填入你的key"
      }
    }
  }
}
```

### Cursor

编辑 `.cursor/mcp.json`（项目级）或 `~/.cursor/mcp.json`（全局）：

```json
{
  "mcpServers": {
    "otscup-site": {
      "url": "https://www.otscup.com/api/mcp",
      "headers": {
        "x-mcp-key": "mcp_填入你的key"
      }
    }
  }
}
```

### Cherry Studio / LM Studio

在 MCP 管理页面添加 server：
- **Name**: `otscup-site`
- **Type**: HTTP / Streamable HTTP
- **URL**: `https://www.otscup.com/api/mcp`
- **Header**: `x-mcp-key: mcp_填入你的key`

### 直接用 curl / HTTP（调试用）

```bash
# 列出文章（无需鉴权）
curl -X POST https://www.otscup.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_posts","arguments":{}}}'

# 新建文章（用独立 key）
curl -X POST https://www.otscup.com/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-mcp-key: mcp_填入你的key' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"create_post","arguments":{"title":"测试","slug":"test-123","body":"# 内容"}}}'
```

## 方式二：本地 stdio（备选）

如果远程不可用，可本地跑：

```json
{
  "mcpServers": {
    "otscup-site": {
      "command": "node",
      "args": ["E:/Desktop/portfolio/mcp/server.mjs"],
      "env": { "OTSCUP_ADMIN_PASS": "<你的后台密码>" }
    }
  }
}
```

## 工具列表（7 个）

| 工具 | 说明 | 需要鉴权 |
|------|------|---------|
| `list_posts` | 列出所有文章 | ❌ |
| `get_post` | 获取单篇（按 slug/id） | ❌ |
| `create_post` | 新建并发布文章 | ✅ |
| `update_post` | 更新文章字段 | ✅ |
| `delete_post` | 删除文章 | ✅ |
| `list_models` | 拉取可用 AI 模型 | ❌ |
| `get_site_info` | 站点概览 | ❌ |

## 在 AI 里的使用示例

```
列出 otscup.com 所有文章
```

```
写一篇关于 "MCP 让 AI 直接管理博客" 的文章，正文 Markdown，标签加 MCP 和 AI
```

```
更新 slug=multi-model-failover 的文章，tags 加上 "MCP"
```

```
删掉 slug 是 test-123 的测试文章
```

## 鉴权说明

- **读操作**（list_posts/get_post/list_models/get_site_info）：无需鉴权，任何人可调
- **写操作**（create/update/delete_post）：必须带 `x-mcp-key` 或 `x-admin-hash` header
- **独立 API Key 优先级更高**：带 `x-mcp-key` 时，即使 key 无效也不会 fallback 到 admin-hash
- **Key 吊销**：在后台删除某个 key 后，该客户端立即无法写入，其他客户端不受影响

## 技术说明

- **传输方式**: Streamable HTTP（远程）/ stdio（本地）
- **SDK**: 远程用原生 JSON-RPC 实现（无外部依赖）；本地用 `@modelcontextprotocol/sdk`
- **部署**: Cloudflare Pages Function，URL `https://www.otscup.com/api/mcp`
- **数据源**: Cloudflare D1（通过函数直接读写）
- **幂等**: create 检查 slug 唯一；update/delete 找不到时报错不操作
- **CORS**: 已开启 `access-control-allow-origin: *`，浏览器端也可调
- **Key 生成**: `mcp_` + 32 位十六进制随机数（`Math.random()` × 16）
- **Key 存储**: 明文存储在 D1 的 `settings.mcpKeys` 数组中，与后台数据同源
