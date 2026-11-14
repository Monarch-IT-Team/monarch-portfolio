// Easter egg: a "Monexarch kernel" console. Opens with the ` / ~ / Ё key or the footer button.

export interface TerminalApi {
  t(key: string): string;
  lang(): string;
  setLang(l: string): void;
  goto(id: string): void;
  sound(on?: boolean): Promise<boolean> | boolean;
  three(on?: boolean): boolean;
  openProject(i: number): void;
  projects: { title: string; url: string; homepage: string }[];
  links: { label: string; href: string; text: string }[];
  years: number;
  since: number;
}

const SECTIONS: Record<string, string> = {
  hero: 'hero', home: 'hero', star: 'hero',
  about: 'about', system: 'about',
  trajectory: 'trajectory', path: 'trajectory', experience: 'trajectory',
  skills: 'skills', neighbourhood: 'skills',
  projects: 'projects', galaxy: 'projects',
  monexarch: 'monexarch', universe: 'monexarch',
  signal: 'signal', contact: 'signal', contacts: 'signal',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(1, n - s.length));

export function initTerminal(api: TerminalApi) {
  let root: HTMLElement | null = null;
  let out!: HTMLElement;
  let input!: HTMLInputElement;
  let lastFocus: Element | null = null;
  const history: string[] = [];
  let hIndex = 0;
  const born = Date.now();

  const print = (html: string, cls = '') => {
    const line = document.createElement('div');
    line.className = `term__l${cls ? ` ${cls}` : ''}`;
    line.innerHTML = html;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;
  };
  const gold = (s: string) => `<span class="t-gold">${s}</span>`;
  const dim = (s: string) => `<span class="t-dim">${s}</span>`;

  const commands: Record<string, { desc: string; hidden?: boolean; run: (args: string[]) => void | Promise<void> }> = {
    help: {
      desc: 'list commands',
      run: () => {
        for (const [name, c] of Object.entries(commands)) if (!c.hidden) print(`${gold(pad(name, 12))}${dim(esc(c.desc))}`, 'pre');
      },
    },
    whoami: {
      desc: 'who is this',
      run: () => {
        print(`${gold('Muhammadamin Gulomov')} — ${esc(api.t('hero.eyebrow'))}`);
        print(esc(api.t('about.body1')));
      },
    },
    neofetch: {
      desc: 'system info',
      run: () => {
        const art = [
          ' *              * ',
          ' │╲            ╱│ ',
          ' │ ╲          ╱ │ ',
          ' │  ╲        ╱  │ ',
          ' │   ╲      ╱   │ ',
          ' │    ╲    ╱    │ ',
          ' │     ╲  ╱     │ ',
          ' │      ++      │ ',
          ' *              * ',
        ];
        const info = [
          gold('monexarch@universe'),
          dim('──────────────────'),
          `${gold(pad('OS', 10))}Monexarch Kernel ${api.years}.0`,
          `${gold(pad('Host', 10))}TSUE · Tashkent`,
          `${gold(pad('Uptime', 10))}${api.years} years (since ${api.since})`,
          `${gold(pad('Shell', 10))}curiosity`,
          `${gold(pad('Modules', 10))}10 disciplines`,
          `${gold(pad('Projects', 10))}${api.projects.length} pinned`,
          `${gold(pad('Locale', 10))}uz · ru · en`,
        ];
        art.forEach((a, i) => print(`${gold(esc(a))}   ${info[i] ?? ''}`, 'pre'));
      },
    },
    skills: {
      desc: 'ten disciplines',
      run: () => {
        for (let i = 0; i < 10; i++) {
          print(`${gold(String(i + 1).padStart(2, '0'))}  ${esc(api.t(`skills.${i}.name`))} ${dim('— ' + esc(api.t(`skills.${i}.text`)))}`);
        }
      },
    },
    projects: {
      desc: 'pinned projects',
      run: () => {
        api.projects.forEach((p, i) => print(`${gold(String(i + 1).padStart(2, '0'))}  ${esc(p.title)}`));
        print(dim('open <n> — fly into a project'));
      },
    },
    open: {
      desc: 'open <n> — fly into project n',
      run: ([n]) => {
        const i = Number(n) - 1;
        if (!Number.isInteger(i) || i < 0 || i >= api.projects.length) {
          print(`open: choose 1–${api.projects.length}`, 't-err');
          return;
        }
        close();
        api.openProject(i);
      },
    },
    contact: {
      desc: 'how to reach him',
      run: () => {
        for (const l of api.links) {
          print(`${gold(pad(l.label, 10))}<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.text)}</a>`, 'pre');
        }
      },
    },
    goto: {
      desc: 'goto <section> — hero about trajectory skills projects monexarch signal',
      run: ([s]) => {
        const id = SECTIONS[(s ?? '').toLowerCase()];
        if (!id) {
          print('goto: hero · about · trajectory · skills · projects · monexarch · signal', 't-err');
          return;
        }
        close();
        api.goto(id);
      },
    },
    lang: {
      desc: 'lang <uz|ru|en>',
      run: ([l]) => {
        if (!['uz', 'ru', 'en'].includes(l)) {
          print(`lang: ${api.lang()} ${dim('(uz · ru · en)')}`);
          return;
        }
        api.setLang(l);
        print(`locale → ${gold(l)}`);
      },
    },
    sound: {
      desc: 'sound [on|off] — space ambience',
      run: async ([v]) => {
        const state = await api.sound(v === 'on' ? true : v === 'off' ? false : undefined);
        print(`sound ${gold(state ? 'on' : 'off')}`);
      },
    },
    '3d': {
      desc: '3d [on|off] — the universe itself',
      run: ([v]) => {
        const state = api.three(v === 'on' ? true : v === 'off' ? false : undefined);
        print(`3d ${gold(state ? 'on' : 'off')}`);
      },
    },
    date: {
      desc: 'time in Tashkent',
      run: () => {
        const s = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Asia/Tashkent', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        }).format(new Date());
        print(`Tashkent · ${s}`);
      },
    },
    uptime: {
      desc: 'how long it has been running',
      run: () => {
        const sec = Math.floor((Date.now() - born) / 1000);
        print(`up ${api.years} years (since ${api.since}) · this session ${Math.floor(sec / 60)}m ${sec % 60}s`);
      },
    },
    echo: { desc: 'echo <text>', run: (a) => print(esc(a.join(' '))) },
    history: { desc: 'previous commands', run: () => history.forEach((h, i) => print(`${dim(String(i + 1).padStart(3))}  ${esc(h)}`, 'pre')) },
    clear: { desc: 'clear the screen', run: () => void (out.innerHTML = '') },
    exit: { desc: 'close (or Esc)', run: () => close() },

    sudo: { desc: '', hidden: true, run: () => print('monexarch is not in the sudoers file. This incident will be reported to the Exarch.', 't-err') },
    rm: { desc: '', hidden: true, run: () => print('rm: cannot remove ‘/universe’: it is still expanding', 't-err') },
    monexarch: { desc: '', hidden: true, run: () => print(`${gold('Monarch × Exarch')} — ${esc(api.t('mx.p1'))}`) },
    hello: { desc: '', hidden: true, run: () => print('Salom! Type help.') },
    ls: { desc: '', hidden: true, run: () => print(`${gold('about/')}  ${gold('skills/')}  ${gold('projects/')}  ${gold('signal/')}  readme.txt`) },
    cat: { desc: '', hidden: true, run: () => print(esc(api.t('about.body2'))) },
  };
  commands.hi = commands.hello;
  commands.salom = commands.hello;
  commands['привет'] = commands.hello;

  async function run(line: string) {
    const raw = line.trim();
    print(`${gold('monexarch@universe')}${dim(':~$')} ${esc(raw)}`, 'term__cmd');
    if (!raw) return;
    history.push(raw);
    hIndex = history.length;
    const [name, ...args] = raw.split(/\s+/);
    const cmd = commands[name.toLowerCase()];
    if (!cmd) {
      print(`${esc(name)}: command not found. Type ${gold('help')}.`, 't-err');
      return;
    }
    await cmd.run(args);
  }

  function complete() {
    const v = input.value;
    const parts = v.split(/\s+/);
    if (parts.length === 1) {
      const hits = Object.keys(commands).filter((c) => !commands[c].hidden && c.startsWith(parts[0].toLowerCase()));
      if (hits.length === 1) input.value = `${hits[0]} `;
      else if (hits.length > 1) print(dim(hits.join('  ')));
    } else if (parts[0] === 'goto') {
      const hits = [...new Set(Object.values(SECTIONS))].filter((s) => s.startsWith(parts[1] ?? ''));
      if (hits.length === 1) input.value = `goto ${hits[0]}`;
      else if (hits.length > 1) print(dim(hits.join('  ')));
    }
  }

  function build() {
    root = document.createElement('div');
    root.className = 'term';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Terminal');
    root.innerHTML = `
      <div class="term__bar">
        <span class="term__title">monexarch@universe — tty1</span>
        <button class="term__close" type="button" aria-label="Close">esc</button>
      </div>
      <div class="term__out" aria-live="polite"></div>
      <form class="term__line">
        <label class="term__prompt" for="term-in"><span class="t-gold">monexarch@universe</span><span class="t-dim">:~$</span></label>
        <input id="term-in" class="term__in" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" />
      </form>`;
    document.body.appendChild(root);
    out = root.querySelector('.term__out')!;
    input = root.querySelector('.term__in')!;
    root.querySelector('.term__close')!.addEventListener('click', close);
    root.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      run(v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        complete();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        hIndex = Math.max(0, hIndex - 1);
        input.value = history[hIndex] ?? '';
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        hIndex = Math.min(history.length, hIndex + 1);
        input.value = history[hIndex] ?? '';
      } else if (e.code === 'Backquote' && !input.value) {
        e.preventDefault();
        close();
      }
    });
    root.addEventListener('pointerdown', (e) => {
      if (!(e.target as Element).closest('a, button')) setTimeout(() => input.focus(), 0);
    });
    print(`${gold(`Monexarch kernel ${api.years}.0.0`)} ${dim('— tty1')}`);
    print(`Type ${gold('help')} to list commands. ${dim('Esc to close.')}`);
  }

  function open() {
    if (!root) build();
    lastFocus = document.activeElement;
    root!.classList.add('is-open');
    document.documentElement.classList.add('mx-term');
    setTimeout(() => input.focus(), 30);
  }

  function close() {
    if (!root?.classList.contains('is-open')) return;
    root.classList.remove('is-open');
    document.documentElement.classList.remove('mx-term');
    (lastFocus as HTMLElement | null)?.focus?.();
  }

  const isOpen = () => !!root?.classList.contains('is-open');

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.key === 'Escape') {
      if (isOpen()) close();
      return;
    }
    if (e.code !== 'Backquote' || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable)) return;
    e.preventDefault();
    if (isOpen()) close();
    else open();
  });

  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest?.('[data-terminal]')) open();
  });

  return { open, close, isOpen };
}
