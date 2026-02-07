#!/usr/bin/env node
/**
 * 将 SVG 图标转换为 PNG
 * 需要安装: npm install sharp
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '..', 'icons')

// 简单的 SVG 转 PNG 占位符生成（纯绿色方块带 M 字母）
function createPlaceholderPng(size) {
  // 创建一个简单的 PNG 占位符
  // 这是一个最小的有效 PNG 文件（绿色方块）
  const header = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  ])
  
  console.log(`请使用以下命令安装 sharp 并重新运行，或手动转换 SVG:`)
  console.log(`  npm install sharp`)
  console.log(`  或使用在线工具: https://svgtopng.com/`)
  return null
}

async function main() {
  const sizes = [16, 48, 128]
  
  console.log('SVG 图标转换工具')
  console.log('=================')
  console.log('')
  
  try {
    // 尝试动态导入 sharp
    const sharp = await import('sharp')
    
    for (const size of sizes) {
      const svgPath = join(iconsDir, `icon${size}.svg`)
      const pngPath = join(iconsDir, `icon${size}.png`)
      
      if (!existsSync(svgPath)) {
        console.log(`跳过: ${svgPath} 不存在`)
        continue
      }
      
      const svgBuffer = readFileSync(svgPath)
      await sharp.default(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(pngPath)
      
      console.log(`✓ 已转换: icon${size}.svg -> icon${size}.png`)
    }
    
    console.log('')
    console.log('✔ 图标转换完成')
  } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('sharp 模块未安装，请运行:')
      console.log('  npm install sharp')
      console.log('')
      console.log('或者手动转换 SVG 文件:')
      sizes.forEach(size => {
        console.log(`  - icons/icon${size}.svg -> icons/icon${size}.png`)
      })
      console.log('')
      console.log('在线工具: https://svgtopng.com/')
    } else {
      throw e
    }
  }
}

main().catch(console.error)
