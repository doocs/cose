# COSE MCP

这个原型支持从桌面 MCP 客户端发送文章，由 COSE 在已配对的 Chrome 使用当前登录的账号填写平台编辑器或保存草稿。

1. 使用 Node.js 22 或更新版本，在仓库根目录运行 `pnpm install --frozen-lockfile` 和 `pnpm build`。在普通桌面 Chrome 打开 `chrome://extensions`，启用开发者模式，选择「加载已解压的扩展程序」，打开 `apps/extension/dist`。
2. 用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` 生成配对令牌。在 MCP 客户端配置下面的本地服务，替换绝对路径和令牌。
3. 在目标 Chrome 窗口点击 COSE 图标，选择「连接本地 MCP」。输入一个便于识别的名称（如「工作 Chrome」）和同一个配对令牌，保持连接页打开。
4. 在 MCP 客户端让 AI 列出已配对的浏览器，再指定目标，例如「把这篇文章存成工作 Chrome 里的 B 站草稿」。确认页会出现在对应窗口，确认后可用 MCP 查询结果。

将以下配置加入 Codex 的 `config.toml`。保存后启动新的 Codex 会话，以加载 COSE MCP。

```toml
[mcp_servers.cose]
command = "node"
args = ["/absolute/path/to/cose/apps/mcp-server/index.mjs"]

[mcp_servers.cose.env]
COSE_MCP_TOKEN = "replace_with_your_generated_token"
```

如果 Codex 找不到 `node`，把 `command` 改为 Node.js 22 可执行文件的绝对路径。

每个连接有独立的 `browser_id`，重新配对后请调用 `list_platforms` 获取当前 ID。请先打开要使用的 Chrome。连接页关闭会断开配对。本机端口为 `127.0.0.1:17831`，同一时间运行一个 COSE MCP 进程。

使用 `list_platforms` 获取平台名称、ID 和可用模式。`create_draft` 的 `platform` 接受平台名称或 ID，例如「知乎」或 `zhihu`。文章传入标题及 `markdown` 或 `text` 其中之一。Markdown 的链接和图片使用 HTTP 或 HTTPS 地址，正文使用 Markdown 语法。

确认同步后，使用同一个请求 ID 调用 `get_draft_status` 查询。B 站、RedNote 和雪球收到平台确认后返回 `saved`。其他平台可能返回 `filled` 或 `review_required`，请在编辑器里核对。若返回 `not_confirmed`，先检查编辑器或草稿列表，再决定是否重试。只要同步还在运行，同一个连接会拒绝新的同步请求。同一 MCP 进程会记录请求 ID，避免重复执行。

WordPress 和 DEV.to 的账号连接依赖 MD 编辑器，列表会标记为 `requires_editor_connection`。

配对失败时，确认 MCP 客户端已启动服务，浏览器和 MCP 服务使用同一份 COSE 构建，并检查令牌及实例名。令牌只用于本机配对，请保存在客户端配置中。
