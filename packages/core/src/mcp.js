import { Marked } from 'marked'
import { PLATFORMS } from './platforms/index.js'

const editorOnly = new Set(['devto', 'wordpress'])
const confirmedDrafts = new Set(['bilibili', 'rednote', 'xueqiu'])
const aliases = {
  b站: 'bilibili',
  哔哩哔哩: 'bilibili',
  微信: 'wechat',
  头条: 'toutiao',
  小红书: 'xiaohongshu',
  x: 'twitter',
}

const normalize = value => value.trim().normalize('NFKC').toLowerCase()

export const mcpPlatforms = PLATFORMS.filter(
  platform => platform.publishUrl || editorOnly.has(platform.id)
).map(platform => ({
  id: platform.id,
  name: platform.title || platform.name,
  mode: editorOnly.has(platform.id)
    ? 'requires_editor_connection'
    : confirmedDrafts.has(platform.id)
      ? 'confirmed_draft'
      : 'editor',
}))

export function resolveMcpPlatform(value) {
  const key = normalize(value)
  const matches = PLATFORMS.filter(
    platform =>
      aliases[key] === platform.id ||
      [platform.id, platform.name, platform.title].some(label => label && normalize(label) === key)
  )
  if (matches.length !== 1) return undefined
  return mcpPlatforms.find(platform => platform.id === matches[0].id)
}

const escapeHtml = value =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function isWebUrl(value) {
  return /^https?:\/\//i.test(value)
}

const markdownParser = new Marked()

function renderMarkdown(markdown) {
  const tokens = markdownParser.lexer(markdown)
  markdownParser.walkTokens(tokens, token => {
    if (token.type === 'html')
      throw new Error('MCP Markdown 正文仅支持 Markdown 语法，请移除内嵌 HTML。')
    if ((token.type === 'image' || token.type === 'link') && !isWebUrl(token.href)) {
      throw new Error('MCP Markdown 的链接和图片需要使用 HTTP 或 HTTPS 地址。')
    }
  })
  return markdownParser.parser(tokens)
}

export function mcpArticleContent({ title, markdown, text }) {
  const body =
    markdown !== undefined
      ? renderMarkdown(markdown)
      : text
          .split(/\r?\n/)
          .map(line => `<p>${escapeHtml(line) || '<br>'}</p>`)
          .join('')
  return { title, body, markdown: markdown ?? text, wechatHtml: body }
}
