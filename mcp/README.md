# OTSCUP MCP 配置指南

让 Claude Desktop / Cursor / Cherry Studio 等 MCP 客户端直接管理 otscup.com 文章。

## 工具列表（7 个）

| 工具 | 说明 | 需要密码 |
|------|------|---------|
| `list_posts` | 列出所有文章 | ❌ |
| `get_post` | 获取单篇（按 slug/id） | ❌ |
| `create_post` | 新建并发布文章 | ✅ |
| `update_post` | 更新文章字段 | ✅ |
| `delete_post` | 删除文章 | ✅ |
| `list_models` | 拉取可用 AI 模型 | ❌ |
| `get_site_info` | 站点概览 | ❌ |

## 配置

### 1. Claude Desktop

编辑 `claude_desktop_config.json`：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "otscup-site": {
      "command": "node",
      "args": ["E:/Desktop/portfolio/mcp/server.mjs"],
      "env": {
        "OTSCUP_ADMIN_PASS": "Qq.470892084"
      }
    }
  }
}
```

### 2. Cursor

编辑 `.cursor/mcp.json`（项目级）或 `~/.cursor/mcp.json`（全局）：

```json
{
  "mcpServers": {
    "otscup-site": {
      "command": "node",
      "args": ["E:/Desktop/portfolio/mcp/server.mjs"],
      "env": {
        "OTSCUP_ADMIN_PASS": "Qq.470892084"
      }
    }
  }
}
```

### 3. Cherry Studio / LM Studio 等

在 MCP 管理页面添加 server：
- **Name**: `otscup-site`
- **Command**: `node`
- **Arguments**: `E:/Desktop/portfolio/mcp/server.mjs`
- **Environment**: `OTSCUP_ADMIN_PASS=Qq.470892084`

## 可选环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OTSCUP_SITE` | `https://www.otscup.com` | 站点地址 |
| `OTSCUP_ADMIN_PASS` | 空 | 管理员口令（写操作需要） |

> 不设置 `OTSCUP_ADMIN_PASS` 时，只读工具（list/get/site_info/models）仍可用，写工具会失败。

## 在 AI 里的使用示例

对话示例：

```
列出 otscup.com 所有文章
```

```
写一篇关于 "MCP 让 AI 直接管理博客" 的文章，标题用这个，正文 Markdown 格式，标签加 MCP 和 AI
```

```
更新 slug=multi-model-failover 的文章，把 tags 加上 "MCP"
```

```
删掉那篇 slug 是 mcp-test-... 的测试文章
```

## 本地开发

```bash
cd E:/Desktop/portfolio/mcp
npm install          # 已安装
node server.mjs      # 启动（stdio 模式，给 MCP 客户端用）
```

## 技术说明

- **传输方式**: stdio（标准输入输出，MCP 客户端直接 fork 子进程）
- **SDK**: `@modelcontextprotocol/sdk` 1.30
- **认证**: 与后台同一密码机制（`sha256('cyber-portfolio-v2' + password)` → `x-admin-hash` header）
- **数据源**: 直接读写 Cloudflare D1（通过 `/api/content` PUT）
- **幂等**: `create_post` 检查 slug 唯一；`update_post` 找不到时报错不创建；`delete_post` 找不到时报错不操作
