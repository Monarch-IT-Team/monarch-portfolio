// Optional hand-written details for pinned repositories, keyed by the repository name.
// Anything missing here falls back to GitHub: the repo description and its languages.
// A newly pinned repo appears on the site automatically; add an entry here only for nicer texts.

import type { Lang } from '../i18n/dict';

export interface ProjectNote {
  title?: string;
  stack?: string[];
  desc?: Partial<Record<Lang, string>>;
}

export const notes: Record<string, ProjectNote> = {
  'Monarch-AI': {
    title: 'Monarch AI',
    stack: ['Rust', 'Tauri', 'React', 'TypeScript', 'Ollama'],
    desc: {
      ru: 'Голосовой AI-ассистент для компьютера, который учится: если не знает команду — спрашивает и запоминает навсегда. Управляет системой, музыкой и приложениями, генерирует изображения.',
      en: 'A voice AI assistant for the desktop that learns: when it doesn’t know a command, it asks — and remembers forever. Controls the system, music and apps, and generates images.',
      uz: 'Kompyuter uchun o‘rganadigan ovozli AI-yordamchi: buyruqni bilmasa — so‘raydi va abadiy eslab qoladi. Tizim, musiqa va ilovalarni boshqaradi, rasm yaratadi.',
    },
  },
  'TSUE-Study-Platform': {
    title: 'TSUE Study Platform',
    stack: ['React', 'TypeScript', 'Vite', 'Three.js', 'Gemini'],
    desc: {
      ru: 'Образовательная платформа для TSUE: Python прямо в браузере, AI-наставник, кабинет преподавателя и обучение в формате космической экспедиции.',
      en: 'A learning platform for TSUE: Python right in the browser, an AI mentor, a teacher dashboard and lessons framed as a space expedition.',
      uz: 'TDIU uchun ta’lim platformasi: brauzerning o‘zida Python, AI-ustoz, o‘qituvchi kabineti va kosmik ekspeditsiya ko‘rinishidagi o‘qish.',
    },
  },
  guessing_game: {
    title: 'Guessing Game',
    stack: ['Rust', 'Nix flakes'],
    desc: {
      ru: 'Консольная игра «угадай число» на Rust в воспроизводимом окружении Nix flakes. Маленький проект — большая дисциплина.',
      en: 'A number-guessing console game in Rust inside a reproducible Nix flakes environment. A small project, a big discipline.',
      uz: 'Rust’dagi «sonni top» konsol o‘yini, Nix flakes yordamida qayta tiklanadigan muhitda. Kichik loyiha — katta intizom.',
    },
  },
  'NixOS-Config': {
    title: 'NixOS Config',
    stack: ['Nix', 'NixOS', 'Flakes', 'Hyprland'],
    desc: {
      ru: 'Декларативная конфигурация рабочей станции на NixOS: flakes, модульная структура, Hyprland. Вся система — в одном репозитории.',
      en: 'A declarative NixOS workstation config: flakes, a modular structure, Hyprland. The whole system in one repository.',
      uz: 'NixOS’dagi ish stansiyasining deklarativ konfiguratsiyasi: flakes, modulli tuzilma, Hyprland. Butun tizim — bitta repozitoriyda.',
    },
  },
};
