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
        "x-admin-hash": "<填入你的 admin-hash>"
      }
    }
  }
}
```

> `x-admin-hash` = `sha256('cyber-portfolio-v2' + '你的后台密码')`。
> 用下面命令计算：
> ```bash
> python -c "import hashlib;print(hashlib.sha256(('cyber-portfolio-v2'+'你的密码').encode()).hexdigest())"
> ```
> 或直接用你的后台密码让 AI 算一下。

### Cursor

编辑 `.cursor/mcp.json`（项目级）或 `~/.cursor/mcp.json`（全局）：

```json
{
  "mcpServers": {
    "otscup-site": {
      "url": "https://www.otscup.com/api/mcp",
      "headers": {
        "x-admin-hash": "<填入你的 admin-hash>"
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
- **Header**: `x-admin-hash: <填入你的 admin-hash>`

### 直接用 curl / HTTP（调试用）

```bash
# 列出文章（无需鉴权）
curl -X POST https://www.otscup.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_posts","arguments":{}}}'

# 新建文章（需鉴权）
curl -X POST https://www.otscup.com/api/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-admin-hash: <填入你的 admin-hash>' \
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
- **写操作**（create/update/delete_post）：必须带 `x-admin-hash` header
- 哈希算法：`sha256('cyber-portfolio-v2' + 你的后台密码)`
- 后台密码就是你在后台「设置」→「后台访问口令」里设的那个

## 技术说明

- **传输方式**: Streamable HTTP（远程）/ stdio（本地）
- **SDK**: 远程用原生 JSON-RPC 实现（无外部依赖）；本地用 `@modelcontextprotocol/sdk`
- **部署**: Cloudflare Pages Function，URL `https://www.otscup.com/api/mcp`
- **数据源**: Cloudflare D1（通过函数直接读写）
- **幂等**: create 检查 slug 唯一；update/delete 找不到时报错不操作
- **CORS**: 已开启 `access-control-allow-origin: *`，浏览器端也可调
