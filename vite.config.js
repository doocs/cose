import { defineConfig } from 'vite'
import { join, resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
    root: '.', // 项目根目录
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        minify: false, // 方便调试，发布时可开启
        modulePreload: false,
        rollupOptions: {
            input: {
                background: resolve(__dirname, 'src/background.js'),
                content: resolve(__dirname, 'src/content.js'),
                inject: resolve(__dirname, 'src/inject.js'),
            },
            output: {
                entryFileNames: 'src/[name].js',
                chunkFileNames: 'src/chunks/[name].js',
                assetFileNames: 'assets/[name].[ext]',
                format: 'es', // ES Modules，适配 Manifest V3
            },
        },
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'manifest.json',
                    dest: '.',
                },
                {
                    src: 'icons',
                    dest: '.',
                },
                {
                    src: 'assets',
                    dest: '.',
                },
            ],
        }),
    ],
})
