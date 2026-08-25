import { describe, expect, test } from 'bun:test'

import { repoPath } from '#tests/helpers/paths'

async function readRepoFile(...segments: string[]) {
  return Bun.file(repoPath(...segments)).text()
}

function cargoPackageBlock(cargoLock: string, packageName: string) {
  return cargoLock.split('[[package]]').find((block) => block.includes(`name = "${packageName}"`))
}

describe('Silverpoint desktop identity boundary', () => {
  test('uses the private root identity without renaming publishable packages', async () => {
    const packageJson = JSON.parse(await readRepoFile('package.json')) as {
      name: string
      version: string
    }
    const bunLock = await readRepoFile('bun.lock')

    expect(packageJson).toMatchObject({ name: 'silverpoint-app', version: '0.6.33' })
    expect(bunLock).toContain('"name": "silverpoint-app"')

    const packageVersions = {
      cli: '0.13.2',
      core: '0.13.2',
      'dom-css': '0.13.2',
      fig: '0.13.2',
      kiwi: '0.13.2',
      mcp: '0.13.2',
      pen: '0.13.2',
      'scene-graph': '0.13.2',
      vue: '0.13.2'
    }
    for (const [packageName, version] of Object.entries(packageVersions)) {
      const packageData = JSON.parse(
        await readRepoFile('packages', packageName, 'package.json')
      ) as { version: string }
      expect(packageData.version).toBe(version)
    }
  })

  test('uses the approved Tauri and Rust Windows identity', async () => {
    const tauri = JSON.parse(await readRepoFile('desktop', 'tauri.conf.json')) as {
      productName: string
      version: string
      identifier: string
      app: { windows: [{ title: string }] }
      bundle: {
        createUpdaterArtifacts: boolean
        fileAssociations: Array<{
          ext: string[]
          name: string
          description: string
          mimeType: string
        }>
      }
    }
    const cargoToml = await readRepoFile('desktop', 'Cargo.toml')
    const cargoLock = await readRepoFile('desktop', 'Cargo.lock')
    const localCargoPackage = cargoPackageBlock(cargoLock, 'open_pencil')

    expect(tauri).toMatchObject({
      productName: 'Silverpoint',
      version: '0.6.33',
      identifier: 'com.dayle22.silverpoint',
      app: { windows: [{ title: 'Silverpoint' }] },
      bundle: { createUpdaterArtifacts: false }
    })
    expect(tauri.bundle.fileAssociations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ext: ['pen'],
          name: 'Silverpoint Design File',
          description: 'Silverpoint design file',
          mimeType: 'application/x-pencil-pen'
        }),
        expect.objectContaining({ ext: ['fig'], mimeType: 'application/x-figma' })
      ])
    )
    expect(cargoToml).toContain('name = "open_pencil"')
    expect(cargoToml).toContain('version = "0.6.33"')
    expect(cargoToml).toContain('name = "Silverpoint"')
    expect(cargoToml).toContain('name = "open_pencil_lib"')
    expect(localCargoPackage).toContain('version = "0.6.32"')
  })

  test('uses Silverpoint on shipped visible identity surfaces', async () => {
    const indexHtml = await readRepoFile('index.html')
    const appVue = await readRepoFile('src', 'App.vue')
    const pwa = await readRepoFile('vite', 'pwa.ts')
    const menu = await readRepoFile('desktop', 'src', 'menu.rs')

    expect(indexHtml).toContain('<title>Silverpoint</title>')
    expect(appVue).toMatch(/titleTemplate:.*Silverpoint/)
    expect(pwa).toContain("name: 'Silverpoint'")
    expect(pwa).toContain("short_name: 'Silverpoint'")
    expect(menu).toContain('SubmenuBuilder::new(app, "Silverpoint")')
    expect(menu).toContain('Some("About Silverpoint")')
    expect(menu).not.toContain('Check for Updates')
    expect(menu).not.toContain('check-updates')
  })

  test('disables startup updater access while retaining inert compatibility files', async () => {
    const appVue = await readRepoFile('src', 'App.vue')
    const menu = await readRepoFile('desktop', 'src', 'menu.rs')
    const lib = await readRepoFile('desktop', 'src', 'lib.rs')
    const updater = await readRepoFile('src', 'app', 'shell', 'updater.ts')
    const tauriRaw = await readRepoFile('desktop', 'tauri.conf.json')
    const tauri = JSON.parse(tauriRaw) as {
      plugins: Record<string, unknown>
    }

    expect(appVue).not.toContain('scheduleStartupUpdateCheck')
    expect(menu).toContain('#[cfg(target_os = "macos")]')
    expect(lib).toContain('tauri_plugin_updater::Builder::new().build()')
    expect(updater).toContain('checkForAppUpdate')
    expect(tauri.plugins).toBeDefined()
    expect(tauri.plugins.updater).toBeUndefined()
    expect(tauriRaw).not.toContain('open-pencil/open-pencil')
    expect(tauriRaw).not.toContain('pubkey')
  })

  test('preserves protected OpenPencil compatibility boundaries', async () => {
    const packageJson = await readRepoFile('package.json')
    const compatibilityGlobals = await readRepoFile('src', 'env.d.ts')
    const paths = await readRepoFile('tests', 'helpers', 'paths.ts')
    const tauri = JSON.parse(await readRepoFile('desktop', 'tauri.conf.json')) as {
      bundle: { fileAssociations: Array<{ ext: string[] }> }
    }

    expect(packageJson).toContain('"@open-pencil/core"')
    expect(compatibilityGlobals).toContain('__OPENPENCIL_APP_VERSION__')
    expect(paths).toContain("'packages/core/src'")
    expect(
      tauri.bundle.fileAssociations.map((association: { ext: string[] }) => association.ext[0])
    ).toEqual(expect.arrayContaining(['pen', 'fig']))
  })
})
