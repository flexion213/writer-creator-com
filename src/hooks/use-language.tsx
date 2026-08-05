import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "de", label: "German", native: "Deutsch" },
  { code: "nl", label: "Dutch", native: "Nederlands" },
  { code: "fr", label: "French", native: "Français" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "zh", label: "Mandarin", native: "中文" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

type Key =
  | "feed" | "notebooks" | "suggestions" | "drawing" | "sandbox" | "settings"
  | "jumpToSection" | "account" | "signOut" | "signIn" | "signedInAs" | "guest"
  | "language" | "languageHint" | "appearance" | "darkOnly";

const en: Record<Key, string> = {
  feed: "Global Feed",
  notebooks: "My Private Notebooks",
  suggestions: "Suggestions Box",
  drawing: "Drawing Studio",
  sandbox: "Tactical Sandbox",
  settings: "Settings",
  jumpToSection: "Jump to a section",
  account: "Account",
  signOut: "Sign out",
  signIn: "Sign in",
  signedInAs: "Signed in as",
  guest: "Browsing as guest",
  language: "Language",
  languageHint: "Choose the language for the app interface.",
  appearance: "Appearance",
  darkOnly: "Writer Creators uses a dark studio theme.",
};

const DICT: Record<LangCode, Partial<Record<Key, string>>> = {
  en: {},
  de: {
    feed: "Globaler Feed", notebooks: "Meine privaten Notizbücher", suggestions: "Vorschlagsbox",
    drawing: "Zeichenstudio", sandbox: "Taktischer Sandkasten", settings: "Einstellungen",
    jumpToSection: "Zu einem Bereich springen", account: "Konto", signOut: "Abmelden", signIn: "Anmelden",
    signedInAs: "Angemeldet als", guest: "Als Gast unterwegs", language: "Sprache",
    languageHint: "Wähle die Sprache der Benutzeroberfläche.", appearance: "Darstellung",
    darkOnly: "Writer Creators nutzt ein dunkles Studio-Design.",
  },
  nl: {
    feed: "Globale feed", notebooks: "Mijn privénotitieboeken", suggestions: "Suggestiebox",
    drawing: "Tekenstudio", sandbox: "Tactische zandbak", settings: "Instellingen",
    jumpToSection: "Ga naar een onderdeel", account: "Account", signOut: "Afmelden", signIn: "Aanmelden",
    signedInAs: "Aangemeld als", guest: "Je bekijkt als gast", language: "Taal",
    languageHint: "Kies de taal van de interface.", appearance: "Weergave",
    darkOnly: "Writer Creators gebruikt een donker studiothema.",
  },
  fr: {
    feed: "Fil global", notebooks: "Mes carnets privés", suggestions: "Boîte à suggestions",
    drawing: "Studio de dessin", sandbox: "Bac à sable tactique", settings: "Paramètres",
    jumpToSection: "Aller à une section", account: "Compte", signOut: "Se déconnecter", signIn: "Se connecter",
    signedInAs: "Connecté en tant que", guest: "Navigation en invité", language: "Langue",
    languageHint: "Choisissez la langue de l'interface.", appearance: "Apparence",
    darkOnly: "Writer Creators utilise un thème studio sombre.",
  },
  es: {
    feed: "Feed global", notebooks: "Mis cuadernos privados", suggestions: "Buzón de sugerencias",
    drawing: "Estudio de dibujo", sandbox: "Arenero táctico", settings: "Ajustes",
    jumpToSection: "Ir a una sección", account: "Cuenta", signOut: "Cerrar sesión", signIn: "Iniciar sesión",
    signedInAs: "Sesión iniciada como", guest: "Navegando como invitado", language: "Idioma",
    languageHint: "Elige el idioma de la interfaz.", appearance: "Apariencia",
    darkOnly: "Writer Creators usa un tema de estudio oscuro.",
  },
  pt: {
    feed: "Feed global", notebooks: "Meus cadernos privados", suggestions: "Caixa de sugestões",
    drawing: "Estúdio de desenho", sandbox: "Caixa de areia tática", settings: "Configurações",
    jumpToSection: "Ir para uma seção", account: "Conta", signOut: "Sair", signIn: "Entrar",
    signedInAs: "Conectado como", guest: "Navegando como visitante", language: "Idioma",
    languageHint: "Escolha o idioma da interface.", appearance: "Aparência",
    darkOnly: "Writer Creators usa um tema de estúdio escuro.",
  },
  ar: {
    feed: "الموجز العام", notebooks: "دفاتري الخاصة", suggestions: "صندوق الاقتراحات",
    drawing: "استوديو الرسم", sandbox: "الساحة التكتيكية", settings: "الإعدادات",
    jumpToSection: "الانتقال إلى قسم", account: "الحساب", signOut: "تسجيل الخروج", signIn: "تسجيل الدخول",
    signedInAs: "مسجّل الدخول باسم", guest: "تتصفح كزائر", language: "اللغة",
    languageHint: "اختر لغة واجهة التطبيق.", appearance: "المظهر",
    darkOnly: "يستخدم Writer Creators مظهرًا داكنًا.",
  },
  zh: {
    feed: "全球动态", notebooks: "我的私人笔记本", suggestions: "建议箱",
    drawing: "绘画工作室", sandbox: "战术沙盘", settings: "设置",
    jumpToSection: "跳转到板块", account: "账户", signOut: "退出登录", signIn: "登录",
    signedInAs: "已登录：", guest: "以访客身份浏览", language: "语言",
    languageHint: "选择应用界面语言。", appearance: "外观",
    darkOnly: "Writer Creators 使用深色工作室主题。",
  },
};

type Ctx = { lang: LangCode; setLang: (l: LangCode) => void; t: (k: Key) => string };
const LanguageContext = createContext<Ctx | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dd:lang") as LangCode | null;
      if (saved && LANGUAGES.some((l) => l.code === saved)) setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: LangCode) => {
    setLangState(l);
    try { window.localStorage.setItem("dd:lang", l); } catch {}
  };

  const t = (k: Key) => DICT[lang]?.[k] ?? en[k];

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: "en" as LangCode, setLang: () => {}, t: (k: Key) => en[k] };
  return ctx;
}
