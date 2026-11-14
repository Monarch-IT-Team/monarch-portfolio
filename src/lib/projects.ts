import data from '../data/projects.json';
import { notes } from '../data/project-notes';
import { LANGS, type Lang } from '../i18n/dict';

interface RawProject {
  name: string;
  owner: string;
  description: string;
  url: string;
  homepage: string;
  stars: number;
  forks: number;
  pushedAt: string;
  createdAt?: string;
  topics: string[];
  languages: { name: string; color: string | null; pct: number }[];
}

export interface Project {
  name: string;
  title: string;
  url: string;
  homepage: string;
  stars: number;
  forks: number;
  pushedAt: string;
  createdAt: string;
  stack: string[];
  languages: { name: string; pct: number }[];
  desc: Record<Lang, string>;
}

function prettify(name: string) {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function loadProjects(): Project[] {
  const items = (data as { items: RawProject[] }).items ?? [];
  return items.map((r) => {
    const note = notes[r.name] ?? {};
    const desc = {} as Record<Lang, string>;
    for (const lang of LANGS) desc[lang] = note.desc?.[lang] ?? r.description ?? '';
    return {
      name: r.name,
      title: note.title ?? prettify(r.name),
      url: r.url,
      homepage: r.homepage,
      stars: r.stars,
      forks: r.forks,
      pushedAt: r.pushedAt,
      createdAt: r.createdAt ?? r.pushedAt,
      // percentages of the shown languages only, so the bar always fills up
      languages: (() => {
        const sum = r.languages.reduce((s, l) => s + l.pct, 0) || 1;
        return r.languages.map((l) => ({ name: l.name, pct: Math.round((l.pct / sum) * 1000) / 10 }));
      })(),
      stack: note.stack ?? r.languages.map((l) => l.name),
      desc,
    };
  });
}
