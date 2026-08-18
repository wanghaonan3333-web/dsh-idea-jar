import { access, readFile } from 'node:fs/promises'

await Promise.all([
  access(new URL('../lib/index.js', import.meta.url)),
  access(new URL('../lib/types/index.d.ts', import.meta.url)),
  access(new URL('../client/client.js', import.meta.url)),
  access(new URL('../cordis.patch.yml', import.meta.url)),
])

const client = await readFile(new URL('../client/client.js', import.meta.url), 'utf8')
if (!/^window\.__ModuleLoader__\.load\(\{\s*id:\s*"dsh-idea-jar"/.test(client)) {
  throw new Error('client bundle is missing the DSH module-loader wrapper')
}

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  throw new Error('package.json must declare dsh.bundle.patch')
}
