import { cac } from 'cac'
import { execa } from 'execa'
import { build as viteBuild } from 'vite'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = fileURLToPath(new URL('./', import.meta.url))
const rootDir = path.join(dirname, '..')

// Read package.json for version
const packageJsonPath = path.join(rootDir, 'package.json')
const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))

// Firefox background uses scripts array, Chrome uses service_worker
interface FirefoxBackgroundOptions {
    scripts: string[]
    type: 'module'
}

interface ChromeBackgroundOptions {
    service_worker: string
    type: 'module'
}

// Full manifest type for COSE extension
interface Manifest {
    manifest_version: number
    name: string
    version: string
    description: string
    permissions: string[]
    host_permissions: string[]
    action: {
        default_icon: Record<string, string>
        default_title: string
    }
    background: FirefoxBackgroundOptions | ChromeBackgroundOptions
    content_scripts: Array<{
        matches: string[]
        js: string[]
        run_at: string
    }>
    icons: Record<string, string>
    web_accessible_resources: Array<{
        resources: string[]
        matches: string[]
    }>
    browser_specific_settings?: {
        gecko: {
            id: string
        }
    }
}

const readManifest = async (manifestPath: string): Promise<Manifest | undefined> => {
    try {
        const fileContent = await fs.readFile(manifestPath, 'utf8')
        const json = JSON.parse(fileContent) as Manifest
        return json
    } catch (error) {
        console.error(error)
        return undefined
    }
}

interface BuildOptions {
    watch: boolean
    release: boolean
    target: 'chromium' | 'firefox' | 'safari'
    bundleId?: string
}

const buildWithVite = async (options: BuildOptions) => {
    console.log('Building with Vite...')

    await viteBuild({
        root: rootDir,
        mode: options.release ? 'production' : 'development',
        build: {
            minify: options.release,
            watch: options.watch ? {} : null,
        },
    })
}

const copyResources = async () => {
    console.log('Copying resources...')

    interface CopyEntry {
        from: string
        to: string
    }

    const copyEntries: CopyEntry[] = [
        {
            from: path.join(rootDir, 'icons'),
            to: path.join(rootDir, 'dist/icons'),
        },
        {
            from: path.join(rootDir, 'assets'),
            to: path.join(rootDir, 'dist/assets'),
        },
        {
            // Copy platform scripts from core package
            from: path.resolve(rootDir, '../../packages/core/src/platforms'),
            to: path.join(rootDir, 'dist/bundles/platforms'),
        },
    ]

    for (const entry of copyEntries) {
        try {
            // Check if source exists
            await fs.access(entry.from)
            // Remove destination if exists
            await fs.rm(entry.to, { recursive: true, force: true })
            // Copy
            await fs.cp(entry.from, entry.to, { recursive: true })
            console.log(`  ✓ Copied ${path.basename(entry.from)}`)
        } catch (error) {
            // Source doesn't exist, skip
            console.log(`  ⚠ Skipped ${path.basename(entry.from)} (not found)`)
        }
    }
}

const genManifest = async (options: BuildOptions) => {
    console.log('Generating manifest.json...')

    const manifest = await readManifest(path.join(rootDir, 'manifest.json'))

    if (!manifest) {
        throw new Error('manifest.json not found')
    }

    if (!manifest.background) {
        throw new Error('manifest.background not found')
    }

    // Firefox-specific adjustments
    if (options.target === 'firefox' && 'service_worker' in manifest.background) {
        // Convert service_worker to scripts array for Firefox
        manifest.background = {
            scripts: [manifest.background.service_worker],
            type: 'module',
        }

        // Add Firefox-specific settings
        manifest.browser_specific_settings = {
            gecko: {
                id: 'cose@doocs.org',
            },
        }

        console.log('  ✓ Converted to Firefox manifest format')
    }

    // Sync version from package.json
    manifest.version = packageJson.version

    // Write manifest to dist
    const outputPath = path.join(rootDir, 'dist/manifest.json')
    await fs.writeFile(
        outputPath,
        JSON.stringify(manifest, null, options.release ? undefined : 2)
    )

    console.log(`  ✓ Generated manifest.json (version: ${manifest.version})`)
}

const buildSafariExtension = async (options: BuildOptions) => {
    console.log('\nConverting to Safari extension...')

    // Check if xcrun is available (macOS only)
    try {
        await execa('xcrun', ['--version'])
    } catch {
        throw new Error(
            'xcrun not found. Safari extension conversion requires:\n' +
            '  1. macOS\n' +
            '  2. Xcode installed (with Command Line Tools)\n' +
            '  3. Run: xcode-select --install'
        )
    }

    const safariProjectDir = path.join(rootDir, 'safari-extension')
    const bundleId = options.bundleId || 'org.doocs.cose'

    // Remove existing Safari project
    await fs.rm(safariProjectDir, { recursive: true, force: true })

    console.log(`  Bundle ID: ${bundleId}`)
    console.log(`  Project location: ${safariProjectDir}`)

    try {
        const result = await execa('xcrun', [
            'safari-web-extension-converter',
            path.join(rootDir, 'dist'),
            '--project-location', safariProjectDir,
            '--app-name', 'COSE',
            '--bundle-identifier', bundleId,
            '--swift',
            '--no-prompt',
            '--no-open'
        ])
        console.log(result.stdout)
        console.log('\n  ✓ Safari extension project created!')
        console.log(`  ✓ Open in Xcode: open ${safariProjectDir}/COSE/COSE.xcodeproj`)
    } catch (error: unknown) {
        const err = error as { stderr?: string; message?: string }
        console.error('Safari conversion failed:', err.stderr || err.message)
        throw error
    }
}

// CLI setup
const cli = cac('cose-build')
cli.help().version(packageJson.version)

cli
    .command('build', 'Build the COSE browser extension')
    .option('-w, --watch', 'Watch mode', { default: false })
    .option('-r, --release', 'Build in release mode with optimizations', { default: false })
    .option('--target <target>', 'Browser target: "chromium", "firefox", or "safari"', { default: 'chromium' })
    .option('--bundle-id <bundleId>', 'Bundle ID for Safari (default: org.doocs.cose)')
    .action(async (options: BuildOptions) => {
        const validTargets = ['chromium', 'firefox', 'safari']
        if (!validTargets.includes(options.target)) {
            throw new Error(`Invalid target: ${options.target}. Use "chromium", "firefox", or "safari".`)
        }

        console.log(`\n=== COSE Build (target: ${options.target}, release: ${options.release}) ===\n`)

        // Step 1: Build with Vite
        await buildWithVite(options)

        // Step 2: Copy resources
        await copyResources()

        // Step 3: Generate manifest
        await genManifest(options)

        // Step 4: Target-specific post-processing
        if (options.target === 'firefox') {
            console.log('\nRunning web-ext lint...')
            try {
                const result = await execa('pnpm', ['exec', 'web-ext', 'lint', '--source-dir', 'dist'])
                console.log(result.stdout)
            } catch (error) {
                console.error('web-ext lint failed:', error)
            }
        } else if (options.target === 'safari') {
            await buildSafariExtension(options)
        }

        console.log(`\n=== Build complete! ===\n`)
    })

cli.parse(process.argv, { run: false })
await cli.runMatchedCommand()
