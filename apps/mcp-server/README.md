# COSE MCP

MCP 是桌面 Chrome 的可选功能。只有在 COSE 中启用配对后，桌面 MCP 客户端才可以把文章发送到这个 Chrome 配置文件，使用当前登录的账号填写平台编辑器或保存草稿。

## 让 AI 帮忙配置

在 COSE 弹窗展开「AI 同步（MCP）」，点「复制配置指令」，也可以先点「查看指令」。还可以复制下面这段话给能运行本地命令和配置 MCP 的桌面 AI。普通 COSE 用户可直接使用扩展的同步功能。

> 请按 COSE 官方说明帮我配置可选的 COSE MCP，使用支持 MCP 的 COSE 扩展和同一版本的本地服务。请先检查 Node.js 和已安装的 COSE，优先用用户级 MCP 配置并保留其他设置。如果已有配对，请继续使用同一个本地令牌。首次配对时再生成令牌。需要选 Chrome 窗口、确认授权或重启客户端时请告诉我。不要在聊天中输出令牌，也不要替我开启自动填写。配置完成后，请用 `list_platforms` 核对目标 Chrome 和可用平台。使用说明见 https://github.com/doocs/cose/blob/main/apps/mcp-server/README.md

配好后，可以说「用 COSE，把上面这篇文章存到工作 Chrome 的 X Articles」。如果有多个浏览器连接，指定配对时填写的名字。

如果文章写在 Doocs MD 官方编辑器或自托管编辑器里，可以直接在编辑器里选平台同步，也可以把标题和 Markdown 交给桌面 AI，由 AI 调用 COSE 同步。

## 本地配置

1. 使用 Node.js 22 或更新版本，在仓库根目录运行 `pnpm install --frozen-lockfile` 和 `pnpm build`。用普通桌面 Chrome 加载支持 MCP 的 COSE 扩展。如果测试仓库构建，在 `chrome://extensions` 开启开发者模式，再通过「加载已解压的扩展程序」选择 `apps/extension/dist`。
2. 在目标 Chrome 窗口的 COSE 弹窗依次展开「AI 同步（MCP）」和「手动配对与设置」，点「生成并复制新令牌」。如果 AI 已在本机生成令牌，可直接用那一份。把同一个令牌填入 Codex 的用户级 `~/.codex/config.toml`，保存后启动新的 Codex 会话。

```toml
[mcp_servers.cose]
command = "node"
args = ["/absolute/path/to/cose/apps/mcp-server/index.mjs"]

[mcp_servers.cose.env]
COSE_MCP_TOKEN = "replace_with_your_generated_token"
# Only for an unpacked build: use its exact ID from chrome://extensions.
# COSE_MCP_EXTENSION_ID = "replace_with_your_unpacked_extension_id"
```

如果 Codex 找不到 `node`，把 `command` 改为 Node.js 22 可执行文件的绝对路径。服务默认仅接受 Chrome 商店版 COSE 的扩展 ID。测试未打包版本时，须填入扩展详情页显示的 ID。

3. 在目标 Chrome 窗口点击工具栏的 COSE 图标，依次展开「AI 同步（MCP）」和「手动配对与设置」。实例名默认为「Chrome」，连接多个实例时可改成不同的名字。确认令牌与客户端配置相同，再点击「启用并配对」。弹窗生成的令牌会自动填入，重新打开弹窗也可以继续配置。「允许自动填写文章和保存草稿」默认不勾选，由你决定是否开启。开启后，AI 的请求可直接填写或保存草稿。关闭时，COSE 会在工具栏弹窗展开「AI 同步（MCP）」并显示文章预览供你确认。如果弹窗没有自动打开，点击带数字提示的 COSE 图标即可。
4. 配对成功后可以关掉弹窗。本机保存配对设置，MCP 服务重启后扩展会自动重连。Chrome 重启后，若该配置文件只有一个普通窗口，扩展会在首次重试时恢复连接；若有多个窗口，打开目标窗口里的 COSE 弹窗，点击「保存并使用此窗口」。在同一次 Chrome 会话里，关闭配对窗口后也需重新选窗口。

弹窗显示「等待桌面 MCP 服务」时，请启动已配置 COSE 的客户端，再等自动重连或点击「立即重连」。

本机端口为 `127.0.0.1:17831`，同一时间运行一个 COSE MCP 进程。要停用功能，在 COSE 弹窗里点「关闭 MCP 并清除配对」。

## 工具及结果

`list_platforms` 返回平台名称、ID 和在线的 Chrome 实例。`create_draft` 的 `platform` 接受平台名称或 ID，例如「知乎」或 `zhihu`。传入标题及 `markdown` 或 `text` 其中之一。Markdown 的链接和图片使用 HTTP 或 HTTPS 地址。

自动模式的初始状态为 `queued`，手动模式为 `awaiting_confirmation`。用原请求 ID 调用 `get_draft_status`。B 站、RedNote 和雪球收到平台确认后返回 `saved`。其他平台可能返回 `filled` 或 `review_required`。若返回 `not_confirmed`，先检查编辑器或草稿列表，再决定是否重试。请求 ID 的去重在同一个 MCP 进程内有效。WordPress 和 DEV.to 的账号连接依赖 MD 编辑器。
