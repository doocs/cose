import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { startBridge } from './bridge.mjs'

const bridge = await startBridge(
  process.env.COSE_MCP_TOKEN,
  undefined,
  process.env.COSE_MCP_EXTENSION_ID
)
const server = new McpServer({ name: 'cose', version: '0.1.0' })
const transport = new StdioServerTransport()
const requestId = z
  .uuid()
  .describe('Client-generated UUID. Reuse it to check or retry the same request.')
const platformName = z.string().trim().min(1).max(100)
const result = value => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  structuredContent: value,
})

server.registerTool(
  'list_platforms',
  {
    description:
      'List supported platforms, paired Chrome instances and whether each requires confirmation. Ask the user which browser to use if it is ambiguous.',
    annotations: { readOnlyHint: true },
  },
  () => result(bridge.listPlatforms())
)

server.registerTool(
  'create_draft',
  {
    description:
      'Fill an editor or save a draft on one or more platforms in the paired Chrome window. The browser handles any required confirmation once per request. Call get_draft_status for each platform result.',
    inputSchema: {
      request_id: requestId,
      browser_id: z.uuid().describe('Exact ID of a connected browser from list_platforms.'),
      platform: platformName
        .optional()
        .describe('Single platform ID or name. Omit when using platforms.'),
      platforms: z
        .array(platformName)
        .min(1)
        .optional()
        .describe(
          'Platform IDs or names from list_platforms, e.g. ["微信公众号", "知乎"]. Omit platform.'
        ),
      title: z.string().trim().min(1).max(200),
      markdown: z
        .string()
        .trim()
        .min(1)
        .max(20000)
        .optional()
        .describe('Article body as Markdown. Provide either markdown or text.'),
      text: z
        .string()
        .trim()
        .min(1)
        .max(20000)
        .optional()
        .describe('Plain text article body. Provide either text or markdown.'),
    },
    annotations: { openWorldHint: true },
  },
  args => result(bridge.createDraft(args))
)

server.registerTool(
  'get_draft_status',
  {
    description:
      'Check whether COSE saved a draft, filled the editor, or requires verification. For a batch, read each item in results. Check the editor or draft list before retrying unconfirmed platforms.',
    inputSchema: { request_id: requestId },
    annotations: { readOnlyHint: true },
  },
  ({ request_id }) => result(bridge.getDraft(request_id))
)

server.server.onclose = () => bridge.close()
await server.connect(transport)
