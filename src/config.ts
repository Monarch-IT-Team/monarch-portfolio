// Main site settings. Everything personal lives here.

export const SITE = {
  name: 'Muhammadamin Ğulomov',
  brand: 'Monexarch',
  url: 'https://monarch-it.github.io',
  githubUser: 'Monarch-IT',

  // Used to compute age and "years in code" in the browser, so the site never goes stale.
  birthDate: '2008-03-28',
  codingSince: 2018,
  phone: '+998 (94) 638-01-63',
  cvFile: '/cv/Muhammadamin_Gulomov_CV.pdf',

  // Google Analytics 4 measurement ID, e.g. 'G-ABC123XYZ9'.
  // Empty string = analytics disabled. Can also be set with the PUBLIC_GA_ID env variable.
  gaId: '',

  // Where the "Send a signal" form posts JSON { name, contact, message, lang, page }.
  // E.g. the Cloudflare Worker from worker/telegram-signal.js, or the Telegram bot backend.
  // Empty = the form copies the text and opens the Telegram chat instead.
  // Can also be set with the PUBLIC_CONTACT_ENDPOINT env variable.
  contactEndpoint: '',

  links: {
    telegram: 'https://t.me/monexarch_theoris',
    telegramHandle: '@monexarch_theoris',
    email: 'monarch.team.official@gmail.com',
    github: 'https://github.com/Monarch-IT',
    githubHandle: 'Monarch-IT',
    linkedin: 'https://www.linkedin.com/in/muhammadamin-gulomov',
    linkedinHandle: 'muhammadamin-gulomov',
    linkedinCerts: 'https://www.linkedin.com/in/muhammadamin-gulomov/details/certifications/',
  },
} as const;
