import assert from 'node:assert/strict'
import test from 'node:test'
import { mcpArticleContent, resolveMcpPlatform } from './mcp.js'

test('MCP resolves platform names and prepares Markdown for rich text and Markdown editors', () => {
  assert.equal(resolveMcpPlatform(' 小红书(海外) ').id, 'rednote')
  assert.equal(resolveMcpPlatform('掘金').id, 'juejin')
  assert.equal(resolveMcpPlatform('X').id, 'twitter')
  const markdown = '# 小节\n\n第一段 **重点**。'
  const article = mcpArticleContent({ title: '文章', markdown })
  assert.equal(article.markdown, markdown)
  assert.match(article.body, /<h1>小节<\/h1>/)
  assert.match(article.wechatHtml, /<strong>重点<\/strong>/)
  assert.throws(() => mcpArticleContent({ markdown: '<img src=x onerror=alert(1)>' }), /HTML/)
  assert.throws(() => mcpArticleContent({ markdown: '[点击](javascript:alert(1))' }), /HTTP/)
})
