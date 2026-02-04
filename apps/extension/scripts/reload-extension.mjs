#!/usr/bin/env node
/**
 * 监听 dist 目录变化，自动刷新 Chrome 扩展
 */

import { watch } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const CDP_URL = 'http://127.0.0.1:9222'

let reloadTimeout = null

async function reloadExtension() {
    try {
        const res = await fetch(`${CDP_URL}/json/list`)
        const pages = await res.json()

        const extPage = pages.find(p => p.url.includes('chrome://extensions'))
        if (!extPage) {
            console.log('[reload] 未找到 chrome://extensions 页面，请打开该页面')
            return
        }

        console.log('[reload] 正在重新加载扩展...')

        const ws = new WebSocket(extPage.webSocketDebuggerUrl)

        await new Promise((resolve) => {
            ws.on('open', () => {
                // 在 extensions 页面中找到 COSE 扩展并点击刷新按钮
                ws.send(JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: {
                        expression: `
              (async () => {
                // 获取 extensions-manager
                const manager = document.querySelector('extensions-manager');
                if (!manager) return 'no-manager';
                
                // 获取 extensions-item-list
                const itemList = manager.shadowRoot.querySelector('extensions-item-list');
                if (!itemList) return 'no-item-list';
                
                // 获取所有扩展卡片
                const items = itemList.shadowRoot.querySelectorAll('extensions-item');
                
                for (const item of items) {
                  const name = item.shadowRoot.querySelector('#name')?.textContent || '';
                  if (name.includes('COSE') || name.includes('多平台')) {
                    // 找到刷新按钮并点击
                    const reloadBtn = item.shadowRoot.querySelector('#dev-reload-button');
                    if (reloadBtn) {
                      reloadBtn.click();
                      return 'ok';
                    }
                    return 'no-reload-btn';
                  }
                }
                return 'not-found';
              })()
            `,
                        awaitPromise: true
                    }
                }))
            })

            ws.on('message', (data) => {
                const msg = JSON.parse(data.toString())
                if (msg.id === 1) {
                    const result = msg.result?.result?.value
                    if (result === 'ok') {
                        console.log('[reload] ✓ 扩展已重新加载')
                    } else if (result === 'no-reload-btn') {
                        console.log('[reload] ⚠ 未找到刷新按钮，请开启 Developer mode')
                    } else if (result === 'not-found') {
                        console.log('[reload] ⚠ 未找到 COSE 扩展')
                    } else {
                        console.log('[reload] ⚠ 刷新失败:', result)
                    }
                    ws.close()
                    resolve()
                }
            })

            ws.on('error', (e) => {
                console.log('[reload] 连接错误:', e.message)
                resolve()
            })

            setTimeout(() => { ws.close(); resolve() }, 3000)
        })
    } catch (e) {
        console.log('[reload] 失败:', e.message)
    }
}

function debounceReload() {
    if (reloadTimeout) clearTimeout(reloadTimeout)
    reloadTimeout = setTimeout(reloadExtension, 800)
}

console.log(`[reload] 监听 ${distDir} 目录变化...`)
console.log('[reload] 确保:')
console.log('  1. Chrome 已用 --remote-debugging-port=9222 启动')
console.log('  2. chrome://extensions 页面已打开')
console.log('  3. Developer mode 已开启')

watch(distDir, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('.DS_Store')) {
        console.log(`[reload] 检测到变化: ${filename}`)
        debounceReload()
    }
})

process.on('SIGINT', () => {
    console.log('\n[reload] 已停止')
    process.exit(0)
})
