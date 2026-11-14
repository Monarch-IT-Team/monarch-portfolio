// Windows with Smart App Control may block unsigned native Node binaries (*.node)
// that Astro uses (the Astro compiler, satteri). Those packages ship WebAssembly builds
// and load them automatically when the native file is blocked — this script installs them.
//
// Local workaround only: CI (Linux) and macOS don't need it. Run after `npm install`:
//   npm run win:fix

import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const nm = path.join(root, 'node_modules');
const require = createRequire(path.join(root, 'package.json'));

function nativePackages() {
  const found = [];
  for (const entry of fs.readdirSync(nm)) {
    const dirs = entry.startsWith('@')
      ? fs.readdirSync(path.join(nm, entry)).map((d) => `${entry}/${d}`)
      : [entry];
    for (const name of dirs) {
      if (!/-win32-x64-msvc$/.test(name)) continue;
      const dir = path.join(nm, name);
      const bin = fs.readdirSync(dir).find((f) => f.endsWith('.node'));
      if (bin) found.push({ name, file: path.join(dir, bin) });
    }
  }
  return found;
}

const blocked = nativePackages().filter(({ file }) => {
  try {
    require(file);
    return false;
  } catch (e) {
    return /Application Control|blocked/i.test(String(e?.message));
  }
});

if (!blocked.length) {
  console.log('[win:fix] no blocked native modules — nothing to do');
  process.exit(0);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wasi-'));
const packs = blocked.map(({ name }) => {
  const version = JSON.parse(fs.readFileSync(path.join(nm, name, 'package.json'), 'utf8')).version;
  const wasi = name.replace(/-win32-x64-msvc$/, '-wasm32-wasi');
  const dir = fs.mkdtempSync(path.join(tmp, 'p-'));
  execSync(`npm pack ${wasi}@${version} --silent`, { cwd: dir, stdio: ['ignore', 'pipe', 'inherit'] });
  const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
  execSync(`tar -xzf "${tgz}"`, { cwd: dir });
  const pkgDir = path.join(dir, 'package');
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
  return { wasi, pkgDir, deps: pkg.dependencies ?? {} };
});

// Runtime deps first (npm would prune the manually copied folders otherwise).
const deps = {};
for (const p of packs) for (const [d, v] of Object.entries(p.deps)) deps[d] = v;
const list = Object.entries(deps).map(([d, v]) => `"${d}@${v}"`).join(' ');
if (list) execSync(`npm install --no-save ${list}`, { cwd: root, stdio: 'inherit' });

for (const p of packs) {
  const dest = path.join(nm, p.wasi);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(p.pkgDir, dest, { recursive: true });
  console.log(`[win:fix] installed ${p.wasi}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
