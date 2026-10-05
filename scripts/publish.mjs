// Builds the app on this computer and publishes the result to the
// `gh-pages` branch, which GitHub Pages serves directly (Settings -> Pages ->
// Deploy from a branch -> gh-pages / root). No GitHub Actions needed.
// Run:  npm run publish
import { execSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const out = (cmd) => execSync(cmd).toString().trim()

const origin = out('git remote get-url origin')
const commit = out('git rev-parse --short HEAD')

run('npm run build')
writeFileSync('dist/.nojekyll', '') // serve files as-is (no Jekyll processing)

if (existsSync('dist/.git')) rmSync('dist/.git', { recursive: true, force: true })
const git = (args) => run(`git ${args}`, { cwd: 'dist' })
git('init -q -b gh-pages')
git('add -A')
git(`-c user.name="Liahona" -c user.email="publish@liahona" commit -q -m "Publish ${commit}"`)
git(`push -q -f ${origin} gh-pages`)
rmSync('dist/.git', { recursive: true, force: true })

console.log(`\nPublished ${commit} to gh-pages.`)
