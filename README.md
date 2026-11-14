# Monexarch — Muhammadamin Gulomov

Личный сайт-визитка. Одна страница, при прокрутке камера отдаляется: звезда → система → окрестности → галактика → вселенная. Каждый раздел живёт на своём масштабе.

**Стек:** Astro · TypeScript · Three.js (свои шейдеры) · GSAP. Сайт статический, деплоится на GitHub Pages.

## Запуск

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # подтянуть закреплённые проекты с GitHub и собрать в dist/
npm run preview    # посмотреть собранную версию
```

> **Windows со Smart App Control.** Если `astro` падает с ошибкой «An Application Control policy has blocked this file», выполните `npm run win:fix`. Скрипт ставит WebAssembly-версии заблокированных модулей. Повторяйте после каждого `npm install`. На Linux и macOS это не нужно.

## Что где менять

| Что | Где |
| --- | --- |
| Ссылки, дата рождения, ID Google Analytics | `src/config.ts` |
| Все тексты (UZ / RU / EN) | `src/i18n/dict.ts` |
| Описания и стек проектов (по желанию) | `src/data/project-notes.ts` |
| Фото | положить `public/photo/portrait.jpg` (или `.png`, `.webp`) — заменит аватар при следующей сборке |
| 3D-сцена: уровни масштаба | `src/scripts/scene/levels.ts` |
| Шейдеры | `src/scripts/scene/materials.ts` |
| Прокрутка, интро, переходы, панель проекта | `src/scripts/main.ts` |
| Звук (генеративный эмбиент) | `src/scripts/sound.ts` |
| Терминал (`~`) и его команды | `src/scripts/terminal.ts` |
| Курсор | `src/scripts/cursor.ts` |
| Стили и цвета | `src/styles/global.css` (переменные в `:root`) |

## Что есть на сайте

- **Системы проектов.** Клик по карточке или по звезде в галактике: камера подлетает к звезде, справа открывается панель с языками, датами и ссылками. Стрелки ← → листают проекты, Esc закрывает.
- **Звук.** Кнопка в шапке, по умолчанию выключен. Музыка генерируется прямо в браузере (Web Audio), аудиофайлов нет. Аккорд раскрывается вместе с масштабом. Выбор запоминается.
- **3D / лёгкий режим.** Кнопка «3D» в шапке полностью отключает WebGL, вместо сцены остаётся статичное звёздное небо. Выбор запоминается.
- **Терминал.** Клавиша `~` (или `Ё` в русской раскладке) или кнопка в футере. Команды: `help`, `whoami`, `neofetch`, `skills`, `projects`, `open 1`, `goto galaxy`, `lang uz`, `sound on`, `3d off`, `date`, `uptime`…
- **Активность.** Год вкладов на GitHub в виде звёздного неба, общая статистика и языки по всем репозиториям (`src/data/github.json`).
- **Страница 404** в стиле сайта.

## Форма «Отправить сигнал» → Telegram

Пока адрес не задан, форма копирует текст и открывает чат в Telegram. Когда бот будет готов:

1. Разверните `worker/telegram-signal.js` в Cloudflare Workers (инструкция в начале файла; нужны токен бота и chat id).
2. Впишите адрес воркера в `contactEndpoint` в `src/config.ts`, либо задайте переменную репозитория `CONTACT_ENDPOINT`.

Форма отправляет `POST` с JSON `{ name, contact, message, lang, page }`. Свой бэкенд бота может принимать этот же формат напрямую.

Язык по умолчанию берётся из системы посетителя (uz → UZ, ru → RU, остальные → EN). Выбор в шапке запоминается. Возраст, «лет в коде» и число орбит считаются в браузере, поэтому их не нужно обновлять вручную.

## Проекты обновляются сами

`scripts/fetch-projects.mjs` берёт репозитории, **закреплённые** в профиле [Monarch-IT](https://github.com/Monarch-IT), и записывает их в `src/data/projects.json`. Заодно он собирает статистику и календарь активности в `src/data/github.json`. GitHub Actions пересобирает сайт при каждом пуше и раз в сутки. Новый закреплённый репозиторий появится на сайте в течение суток. Описание берётся из поля About на GitHub; красивый перевод на три языка можно добавить в `project-notes.ts`.

GitHub отключает ежедневный запуск, если в публичном репозитории 60 дней не было активности. Тогда достаточно любого коммита или ручного запуска: Actions → Deploy → Run workflow.

## Деплой на GitHub Pages

1. Сейчас сайт живёт в репозитории `monarch-portfolio` по адресу https://monarch-it.github.io/monarch-portfolio/ (в `astro.config.mjs` задан `base`). Когда владелец Monarch-IT переименует репозиторий в `monarch-it.github.io`, сайт откроется по адресу https://monarch-it.github.io: тогда удалите строку `base` в `astro.config.mjs`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Пушим в `main`. Сборку и публикацию делает `.github/workflows/deploy.yml`.

### Google Analytics

Создайте ресурс GA4 и скопируйте Measurement ID (`G-XXXXXXXXXX`). Затем либо впишите его в `gaId` в `src/config.ts`, либо добавьте переменную репозитория `GA_ID` (Settings → Secrets and variables → Actions → Variables). Пока ID пустой, аналитика не подключается.

## Полезные параметры URL

- `?nointro` — не показывать интро (оно и так показывается один раз на браузер).
- `?shot` — переходы между масштабами без плавности (для скриншотов).
