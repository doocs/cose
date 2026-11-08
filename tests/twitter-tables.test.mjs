import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareTwitterTables } from '../packages/core/src/platforms/twitter-tables.js'

test('X Articles keeps table Markdown and positions without touching a matching fenced example', () => {
  const first = '| 项目 | 数量 |\n| :--- | ---: |\n| 苹果 \\| 梨 | **3** |'
  const second = '列 A | 列 B\n--- | ---\n链接 | [说明](https://example.com)'
  const code = '```markdown\n' + first + '\n```'
  const markdown = [code, '表格前', first, '两张表之间', second, '表格后'].join('\n\n')
  const result = prepareTwitterTables(markdown, 'test')
  assert.deepEqual(result.tables, [
    { marker: 'COSETABLEtestN1END', markdown: first, rows: 2, columns: 2 },
    { marker: 'COSETABLEtestN2END', markdown: second, rows: 2, columns: 2 },
  ])
  assert.deepEqual(result.markdown.trim().split(/\n{2,}/), [
    code,
    '表格前',
    result.tables[0].marker,
    '两张表之间',
    result.tables[1].marker,
    '表格后',
  ])
})

test('X Articles leaves Markdown without tables unchanged', () => {
  const markdown = '普通段落中的 a | b\r\n\r\n    | 不应转换 |\r\n    | --- |'
  assert.deepEqual(prepareTwitterTables(markdown, 'test'), { markdown, tables: [] })
})
