export type ChangeCategory =
  | "feature"
  | "fix"
  | "refactor"
  | "style"
  | "perf"
  | "security"
  | "docs"
  | "chore";

export type ChangelogEntry = {
  date: string;
  category: ChangeCategory;
  description: string;
  description_ru: string;
  description_en: string;
};

export const CHANGELOG_DATA: ChangelogEntry[] = [
  // ── 2026-02-15 ────────────────────────────────────────────────
  {
    date: "2026-02-15",
    category: "feature",
    description: "Statistika igraca na stranici turnira + univerzalna tabela statistike sa avatarima",
    description_ru: "Статистика игроков на странице турнира + универсальная таблица статистики с аватарами",
    description_en: "Player stats on tournament page + reusable stats table component with avatars",
  },
  // ── 2026-02-14 ────────────────────────────────────────────────
  {
    date: "2026-02-14",
    category: "feature",
    description: "Redizajn unosa golova: jednostavniji formular (strelac + opcioni asistenti), progresivni prikaz na mobilnom",
    description_ru: "Редизайн ввода голов: упрощённая форма (автор + ассисты), прогрессивный показ на мобильном",
    description_en: "Goal input redesign: simplified form (scorer + optional assists), progressive reveal on mobile",
  },
  {
    date: "2026-02-14",
    category: "feature",
    description: "Tab za golove u editoru utakmice + prikaz strelaca na posteru rezultata",
    description_ru: "Вкладка голов в редакторе матча + отображение авторов голов на постере результата",
    description_en: "Goals tab in game editor + goal scorers displayed on result poster",
  },
  {
    date: "2026-02-14",
    category: "fix",
    description: "Ispravljen prikaz logotipa protivnika za turnirske utakmice",
    description_ru: "Исправлено отображение логотипа соперника для турнирных игр",
    description_en: "Fixed opponent logo display for tournament games",
  },
  // ── 2026-02-13 (refactor) ────────────────────────────────────
  {
    date: "2026-02-13",
    category: "refactor",
    description: "Ujednačen popup za uređivanje igrača: isti dizajn na javnim stranicama i u admin panelu",
    description_ru: "Унифицирован попап редактирования игрока: одинаковый дизайн на публичных страницах и в админке",
    description_en: "Unified player edit popup: same design on public pages and in admin panel",
  },
  // ── 2026-02-13 (SEO) ───────────────────────────────────────
  {
    date: "2026-02-13",
    category: "feature",
    description: "Kompletna SEO optimizacija: metadata za sve stranice, Open Graph tagovi, robots.txt, sitemap.xml, manifest, JSON-LD strukturirani podaci, višejezični hreflang linkovi",
    description_ru: "Полная SEO-оптимизация: метаданные для всех страниц, Open Graph теги, robots.txt, sitemap.xml, манифест, JSON-LD структурированные данные, мультиязычные hreflang ссылки",
    description_en: "Full SEO optimization: metadata for all pages, Open Graph tags, robots.txt, sitemap.xml, manifest, JSON-LD structured data, multilingual hreflang links",
  },
  {
    date: "2026-02-13",
    category: "fix",
    description: "Ispravljen atribut lang na HTML elementu — sada se menja prema izabranom jeziku",
    description_ru: "Исправлен атрибут lang на HTML элементе — теперь меняется в зависимости от выбранного языка",
    description_en: "Fixed lang attribute on HTML element — now changes based on selected locale",
  },
  // ── 2026-02-13 (cont.) ─────────────────────────────────────
  {
    date: "2026-02-13",
    category: "feature",
    description: "Lepljivi zaglavlja na svim admin stranicama, uklonjen nepotreban skrol",
    description_ru: "Липкие заголовки на всех страницах админки, убран лишний скролл",
    description_en: "Sticky headers on all admin pages, removed unnecessary scroll",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Stranica treninga: sledeći trening istaknut, ostali u sklopivim sekcijama",
    description_ru: "Страница тренировок: ближайшая тренировка выделена, остальные в сворачиваемых секциях",
    description_en: "Training page: next session highlighted, others in collapsible sections",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Brzo uređivanje utakmica, treninga i igrača direktno sa javnih stranica za admine",
    description_ru: "Быстрое редактирование матчей, тренировок и игроков прямо с публичных страниц для админов",
    description_en: "Quick edit buttons for games, training sessions, and players on public pages for admins",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Dodata uloga trenera za članove tima",
    description_ru: "Добавлена роль тренера для членов команды",
    description_en: "Added coach role for team members",
  },
  // ── 2026-02-13 ──────────────────────────────────────────────
  {
    date: "2026-02-13",
    category: "feature",
    description: "Poboljšan izbor zemlje sa automatskim dopunjavanjem i zastavicama",
    description_ru: "Улучшен выбор страны с автодополнением и флагами",
    description_en: "Enhanced country selection with autocomplete and flags",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Redizajnirane kartice turnirskih mečeva, razdvojena lista mečeva",
    description_ru: "Переработаны карточки турнирных матчей, разделён список матчей",
    description_en: "Redesigned tournament match cards, split match list",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Turnirski mečevi preusmereni na jedinstveni editor igara",
    description_ru: "Турнирные матчи перенаправлены в единый редактор игр",
    description_en: "Tournament matches redirected to unified game editor",
  },
  {
    date: "2026-02-13",
    category: "feature",
    description: "Spinneri zamenjeni skeleton komponentama za učitavanje",
    description_ru: "Спиннеры загрузки заменены на skeleton-компоненты",
    description_en: "Replaced spinner loading states with skeleton components",
  },
  {
    date: "2026-02-13",
    category: "perf",
    description: "Dinamički importi, Map lookups, error boundary za bolje performanse",
    description_ru: "Динамические импорты, Map lookups, error boundary для производительности",
    description_en: "Dynamic imports, Map lookups, error boundary for better performance",
  },
  {
    date: "2026-02-13",
    category: "security",
    description: "Poboljšana bezbednost baze podataka i RLS politike",
    description_ru: "Улучшена безопасность базы данных и RLS-политики",
    description_en: "Improved database security and RLS policies",
  },
  {
    date: "2026-02-13",
    category: "refactor",
    description: "LoadingErrorEmpty primenjen na sve admin stranice, SelectWithNone za timove",
    description_ru: "LoadingErrorEmpty применён на всех admin-страницах, SelectWithNone для команд",
    description_en: "LoadingErrorEmpty applied to all admin pages, SelectWithNone for teams",
  },

  // ── 2026-02-12 ──────────────────────────────────────────────
  {
    date: "2026-02-12",
    category: "feature",
    description: "Vercel Web Analytics integrisan u aplikaciju",
    description_ru: "Vercel Web Analytics интегрирован в приложение",
    description_en: "Vercel Web Analytics integrated into the app",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Testovi pristupačnosti, popravke mobilnog prikaza, WCAG poboljšanja",
    description_ru: "Тесты доступности, исправления мобильного отображения, улучшения WCAG",
    description_en: "Accessibility tests, mobile responsiveness fixes, WCAG improvements",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Brisanje timova i redizajn grid prikaza timova sa velikim avatarima",
    description_ru: "Удаление команд и редизайн сетки команд с большими аватарами",
    description_en: "Team deletion and redesigned team grid with large avatars",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Admin link dodat u header sa uslovnom vidljivošću",
    description_ru: "Admin-ссылка добавлена в header с условной видимостью",
    description_en: "Admin link added to header with conditional visibility",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Poboljšan lineup editor sa prikazom svih linija i mobilnim stilom",
    description_ru: "Улучшен редактор расстановки с отображением всех линий и мобильным стилем",
    description_en: "Improved lineup editor with all-lines view and mobile styling",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Dijalog za isecanje avatara sa zumiranjem i pomeranjem",
    description_ru: "Диалог обрезки аватара с зумом и панорамированием",
    description_en: "Avatar crop dialog with zoom and pan",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Puna imena sa nadimcima u turnirskom rosteru",
    description_ru: "Полные имена с никнеймами в турнирном составе",
    description_en: "Full names with nicknames in tournament roster",
  },
  {
    date: "2026-02-12",
    category: "feature",
    description: "Standardizovani zaglavlja admin stranica sa AdminPageHeader",
    description_ru: "Стандартизированные заголовки admin-страниц через AdminPageHeader",
    description_en: "Standardized admin page headers with AdminPageHeader component",
  },
  {
    date: "2026-02-12",
    category: "fix",
    description: "Zamenjeni hardkodirani stringovi i18n prevodima u admin panelu",
    description_ru: "Заменены захардкоженные строки i18n-переводами в admin-панели",
    description_en: "Replaced hardcoded strings with i18n translations in admin panel",
  },
  {
    date: "2026-02-12",
    category: "fix",
    description: "Ispravljen bug beskonačnog učitavanja u lineup editoru",
    description_ru: "Исправлен баг бесконечной перезагрузки в редакторе расстановки",
    description_en: "Fixed infinite reload loop in lineup editor",
  },
  {
    date: "2026-02-12",
    category: "refactor",
    description: "HockeyRink spojen sa GameLineupEditor u readOnly režimu",
    description_ru: "HockeyRink объединён с GameLineupEditor в режиме readOnly",
    description_en: "Merged HockeyRink into GameLineupEditor with readOnly mode",
  },
  {
    date: "2026-02-12",
    category: "style",
    description: "Poliranje lineup komponente: veličine krugova, avatari, mobilni layout",
    description_ru: "Полировка компонента расстановки: размеры кругов, аватары, мобильный layout",
    description_en: "Lineup component polish: circle sizes, avatars, mobile layout",
  },
  {
    date: "2026-02-12",
    category: "style",
    description: "Finalizacija dizajna meč kartica i redizajn editora mečeva",
    description_ru: "Финализация дизайна карточек матчей и редизайн редактора матчей",
    description_en: "Finalized match card design and match editor header redesign",
  },

  // ── 2026-02-11 ──────────────────────────────────────────────
  {
    date: "2026-02-11",
    category: "feature",
    description: "Jedinstvena struktura stranica mečeva sa 5 tabova za sve tipove mečeva",
    description_ru: "Единая структура страниц матчей с 5 вкладками для всех типов матчей",
    description_en: "Unified match page structure with 5 tabs for all match types",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Dodato uređivanje osnovnih polja za obične mečeve",
    description_ru: "Добавлено редактирование базовых полей для обычных матчей",
    description_en: "Added basic field editing for regular matches",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Svi hardkodirani stringovi zamenjeni i18n prevodima",
    description_ru: "Все захардкоженные строки заменены i18n-переводами",
    description_en: "All hardcoded strings replaced with i18n translations",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Admin edit link dodat na GameMatchCard sa poboljšanim responsive dizajnom",
    description_ru: "Admin edit ссылка добавлена на GameMatchCard с улучшенным responsive-дизайном",
    description_en: "Admin edit link added to GameMatchCard with improved responsive design",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Mobilna horizontalna navigacija i Playwright e2e testovi",
    description_ru: "Мобильная горизонтальная навигация и Playwright e2e-тесты",
    description_en: "Mobile horizontal scroll navigation and Playwright e2e testing",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Poboljšano upravljanje igračima i vizuelni dizajn tima",
    description_ru: "Улучшено управление игроками и визуальный дизайн команды",
    description_en: "Improved player management and team visuals",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Uprošćeno kreiranje naloga igrača i poboljšan tok treninga",
    description_ru: "Упрощено создание аккаунтов игроков и улучшен процесс тренировок",
    description_en: "Simplified player account setup and improved training workflow",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Deklarisani roster za turnire sa izborom lineup-a",
    description_ru: "Заявленный состав для турниров с выбором расстановки",
    description_en: "Tournament declared roster for lineup selection",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Prošireno upravljanje treninzima: zakazivanje, statusi i detalji meča",
    description_ru: "Расширено управление тренировками: расписание, статусы и детали матча",
    description_en: "Extended training management with scheduling, statuses, and match details",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Redizajn hokejskog terena: vertikalno polupolje sa ledenom površinom",
    description_ru: "Редизайн хоккейной площадки: вертикальное полуполе с ледовой поверхностью",
    description_en: "Hockey rink redesign: vertical half-field with ice surface",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Poboljšana tabela igrača u admin panelu",
    description_ru: "Улучшена таблица игроков в admin-панели",
    description_en: "Improved players table in admin panel",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Redizajn landing stranice sa novim vizualima i logotipom tima",
    description_ru: "Редизайн лендинга с новыми визуалами и логотипом команды",
    description_en: "Landing page redesign with new visuals and team logo",
  },
  {
    date: "2026-02-11",
    category: "feature",
    description: "Poboljšan prikaz rasporeda na terenu sa automatskim čuvanjem",
    description_ru: "Улучшено отображение расстановки на площадке с автосохранением",
    description_en: "Improved lineup display with auto-save",
  },
  {
    date: "2026-02-11",
    category: "refactor",
    description: "Zamena tabele Opponents sa Teams i migracija baze podataka",
    description_ru: "Замена таблицы Opponents на Teams и миграция базы данных",
    description_en: "Replaced Opponents table with Teams and database migration",
  },
  {
    date: "2026-02-11",
    category: "fix",
    description: "Kritične ispravke autorizacije i admin panela",
    description_ru: "Критические исправления авторизации и admin-панели",
    description_en: "Critical auth and admin panel fixes",
  },
  {
    date: "2026-02-11",
    category: "fix",
    description: "Ispravke sesije, brisanja igrača, ESLint grešaka i DOM nesting errora",
    description_ru: "Исправления сессий, удаления игроков, ESLint-ошибок и DOM nesting errors",
    description_en: "Session persistence, player deletion, ESLint errors, and DOM nesting fixes",
  },
  {
    date: "2026-02-11",
    category: "fix",
    description: "Ispravljen cookie maxAge umesto nevažećeg lifetime svojstva",
    description_ru: "Исправлен cookie maxAge вместо невалидного свойства lifetime",
    description_en: "Fixed cookie maxAge replacing invalid lifetime property",
  },

  // ── 2026-02-10 ──────────────────────────────────────────────
  {
    date: "2026-02-10",
    category: "feature",
    description: "Redizajn lineup editora sa vizuelnim pozicijama i dodati turniri",
    description_ru: "Редизайн редактора расстановки с визуальными позициями, добавлены турниры",
    description_en: "Lineup editor redesign with visual position slots, tournaments added",
  },
  {
    date: "2026-02-10",
    category: "feature",
    description: "Logotip tima dodat na sve brendirane elemente",
    description_ru: "Логотип команды добавлен на все брендированные элементы",
    description_en: "Team logo added across all branding spots",
  },
  {
    date: "2026-02-10",
    category: "feature",
    description: "Uređivanje igrača, trening timovi i vizualizacija hokejskog terena",
    description_ru: "Редактирование игроков, тренировочные команды и визуализация площадки",
    description_en: "Player editing, training teams, and hockey rink visualization",
  },
  {
    date: "2026-02-10",
    category: "feature",
    description: "Poboljšan UI svih stranica, priprema za Vercel deployment",
    description_ru: "Улучшен UI всех страниц, подготовка к деплою на Vercel",
    description_en: "Improved UI across all pages, prepared for Vercel deployment",
  },
  {
    date: "2026-02-10",
    category: "feature",
    description: "Početno postavljanje projekta — sajt hokejskog tima HC Propeleri",
    description_ru: "Начальная настройка проекта — сайт хоккейной команды HC Propeleri",
    description_en: "Initial project setup — HC Propeleri hockey team website",
  },
];
