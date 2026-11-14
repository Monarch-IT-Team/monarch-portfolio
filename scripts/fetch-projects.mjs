// Fetches the repositories pinned on the GitHub profile (src/data/projects.json)
// and public profile stats + the contribution calendar (src/data/github.json).
// Runs before every build (npm run build) and daily in GitHub Actions.
//
// 1. With a token (GITHUB_TOKEN in Actions) — GraphQL `pinnedItems`, the exact pinned list.
// 2. Without a token — reads the pinned names from the public profile page + REST API.
// 3. If both fail — keeps the previous projects.json so the build never breaks.

import { readFile, writeFile } from 'node:fs/promises';

const USER = 'Monarch-IT';
const OUT = new URL('../src/data/projects.json', import.meta.url);
const OUT_STATS = new URL('../src/data/github.json', import.meta.url);
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const UA = { 'User-Agent': 'monexarch-site-build' };

// Languages that describe tooling rather than the project itself.
const NOISE = new Set(['Makefile', 'Batchfile', 'PowerShell', 'DTrace', 'Procfile', 'Dockerfile']);

function pickLanguages(edges, total) {
  return edges
    .filter((e) => !NOISE.has(e.name) && e.size / total >= 0.02)
    .slice(0, 4)
    .map((e) => ({ name: e.name, color: e.color || null, pct: Math.round((e.size / total) * 1000) / 10 }));
}

async function viaGraphQL() {
  const query = `query($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: [REPOSITORY]) {
        nodes { ... on Repository {
          name owner { login } description url homepageUrl stargazerCount forkCount pushedAt createdAt
          repositoryTopics(first: 8) { nodes { topic { name } } }
          languages(first: 8, orderBy: { field: SIZE, direction: DESC }) { totalSize edges { size node { name color } } }
        } }
      }
    }
  }`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...UA, Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${json.errors.map((e) => e.message).join('; ')}`);
  const nodes = json.data?.user?.pinnedItems?.nodes;
  if (!Array.isArray(nodes)) throw new Error('GraphQL: no pinnedItems');
  return nodes.map((r) => ({
    name: r.name,
    owner: r.owner.login,
    description: r.description || '',
    url: r.url,
    homepage: r.homepageUrl || '',
    stars: r.stargazerCount,
    forks: r.forkCount,
    pushedAt: r.pushedAt,
    createdAt: r.createdAt,
    topics: r.repositoryTopics.nodes.map((n) => n.topic.name),
    languages: pickLanguages(
      r.languages.edges.map((e) => ({ name: e.node.name, color: e.node.color, size: e.size })),
      r.languages.totalSize || 1,
    ),
  }));
}

async function viaProfilePage() {
  const html = await (await fetch(`https://github.com/${USER}`, { headers: UA })).text();
  const names = [...html.matchAll(/<span class="repo"[^>]*>\s*([^<]+?)\s*<\/span>/g)].map((m) => m[1].trim());
  const unique = [...new Set(names)];
  if (!unique.length) throw new Error('profile page: no pinned repositories found');

  const headers = { ...UA, Accept: 'application/vnd.github+json', ...(TOKEN ? { Authorization: `bearer ${TOKEN}` } : {}) };
  const items = [];
  for (const full of unique) {
    const [owner, name] = full.includes('/') ? full.split('/') : [USER, full];
    const r = await (await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers })).json();
    if (!r || !r.name) continue;
    const langs = await (await fetch(`https://api.github.com/repos/${owner}/${name}/languages`, { headers })).json();
    const entries = Object.entries(langs || {}).map(([n, size]) => ({ name: n, color: null, size }));
    const total = entries.reduce((s, e) => s + e.size, 0) || 1;
    items.push({
      name: r.name,
      owner: r.owner.login,
      description: r.description || '',
      url: r.html_url,
      homepage: r.homepage || '',
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
      createdAt: r.created_at,
      topics: r.topics || [],
      languages: pickLanguages(entries, total),
    });
  }
  if (!items.length) throw new Error('REST: no repositories resolved');
  return items;
}

async function main() {
  await stats();
  let items = null;
  let source = '';
  if (TOKEN) {
    try {
      items = await viaGraphQL();
      source = 'graphql';
    } catch (e) {
      console.warn(`[projects] ${e.message}`);
    }
  }
  if (!items) {
    try {
      items = await viaProfilePage();
      source = 'profile+rest';
    } catch (e) {
      console.warn(`[projects] ${e.message}`);
    }
  }
  if (!items) {
    try {
      await readFile(OUT, 'utf8');
      console.warn('[projects] using the cached src/data/projects.json');
    } catch {
      await writeFile(OUT, JSON.stringify({ fetchedAt: null, source: 'empty', items: [] }, null, 2) + '\n');
      console.warn('[projects] no data, wrote an empty list');
    }
    return;
  }
  await writeFile(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), source, items }, null, 2) + '\n');
  console.log(`[projects] ${items.length} pinned via ${source}: ${items.map((i) => i.name).join(', ')}`);
}

/* ------------------------------------------------------------ profile stats */

async function json(url) {
  const headers = { ...UA, Accept: 'application/vnd.github+json', ...(TOKEN ? { Authorization: `bearer ${TOKEN}` } : {}) };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

// The public contribution calendar: one cell per day, level 0–4.
async function contributions() {
  const html = await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: UA })).text();
  const cells = new Map();
  for (const m of html.matchAll(/<td[^>]*data-date="([^"]+)"[^>]*id="contribution-day-component-(\d+)-(\d+)"[^>]*data-level="(\d)"/g)) {
    cells.set(`${m[2]}-${m[3]}`, { date: m[1], d: +m[2], w: +m[3], l: +m[4], c: 0 });
  }
  for (const m of html.matchAll(/for="contribution-day-component-(\d+)-(\d+)"[^>]*>(\d+) contributions?/g)) {
    const cell = cells.get(`${m[1]}-${m[2]}`);
    if (cell) cell.c = +m[3];
  }
  const days = [...cells.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 300) throw new Error(`contributions: only ${days.length} days parsed`);
  return { total: days.reduce((s, x) => s + x.c, 0), days: days.map((x) => [x.date, x.w, x.d, x.l, x.c]) };
}

async function stats() {
  try {
    const user = await json(`https://api.github.com/users/${USER}`);
    const repos = (await json(`https://api.github.com/users/${USER}/repos?per_page=100&type=owner`)).filter((r) => !r.fork);
    const bytes = {};
    for (const r of repos) {
      const langs = await json(r.languages_url);
      for (const [name, size] of Object.entries(langs)) if (!NOISE.has(name)) bytes[name] = (bytes[name] || 0) + size;
    }
    const total = Object.values(bytes).reduce((s, x) => s + x, 0) || 1;
    const languages = Object.entries(bytes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, size]) => ({ name, pct: Math.round((size / total) * 1000) / 10 }));
    const calendar = await contributions();
    const out = {
      fetchedAt: new Date().toISOString(),
      repos: user.public_repos,
      followers: user.followers,
      stars: repos.reduce((s, r) => s + r.stargazers_count, 0),
      languages,
      contributions: calendar.total,
      days: calendar.days,
    };
    await writeFile(OUT_STATS, JSON.stringify(out) + '\n');
    console.log(`[stats] ${out.repos} repos, ${out.stars} stars, ${out.contributions} contributions`);
  } catch (e) {
    console.warn(`[stats] ${e.message} — keeping the cached src/data/github.json`);
    try {
      await readFile(OUT_STATS, 'utf8');
    } catch {
      await writeFile(OUT_STATS, JSON.stringify({ fetchedAt: null, repos: 0, followers: 0, stars: 0, languages: [], contributions: 0, days: [] }) + '\n');
    }
  }
}

main().catch((e) => {
  console.warn(`[projects] unexpected: ${e.message}`);
});
