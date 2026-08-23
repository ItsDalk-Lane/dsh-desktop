import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const workflow = readFileSync(resolve(repositoryRoot, '.github/workflows/build-app.yml'), 'utf8')
const readme = readFileSync(resolve(repositoryRoot, 'README.md'), 'utf8')

describe('desktop GitHub Release workflow', () => {
  it('builds the monorepo with the pinned pnpm and packages the desktop app', () => {
    expect(workflow).toContain('corepack enable')
    expect(workflow).toContain('corepack pnpm install --frozen-lockfile')
    expect(workflow).toContain(
      'corepack pnpm --filter @deepseek-ai/dsh-desktop run dist',
    )
  })

  it('builds macOS and Windows installers from a per-OS matrix', () => {
    expect(workflow).toContain('macos-15')
    expect(workflow).toContain('windows-latest')
    expect(workflow).toContain('app-macos')
    expect(workflow).toContain('app-win32-x64')
  })

  it('attaches installers and auto-update metadata to app-v* releases only', () => {
    expect(workflow).toContain("- 'app-v*'")
    expect(workflow).toContain('if: startsWith(github.ref, \'refs/tags/app-v\')')
    expect(workflow).toContain('needs: build')
    expect(workflow).toContain('gh release create "$TAG" -R "$GITHUB_REPOSITORY"')
    expect(workflow).toContain('release-dist/*.dmg')
    expect(workflow).toContain('release-dist/*.exe')
    expect(workflow).toContain('release-dist/*.yml')
    expect(workflow).toContain('release-dist/*.blockmap')
  })

  it('does not disable ad-hoc signing discovery on macOS', () => {
    // identity: '-' 的 ad-hoc 签名必须被执行:设 CSC_IDENTITY_AUTO_DISCOVERY=false
    // 会连 ad-hoc 都跳过,下载安装的包会被 Gatekeeper 以签名不一致死拦
    expect(workflow).not.toContain('CSC_IDENTITY_AUTO_DISCOVERY')
  })

  it('keeps the public download and update channel in the README', () => {
    expect(readme).toContain('app-v*')
    expect(readme).toContain('ItsDalk-Lane/dsh-desktop')
  })
})
