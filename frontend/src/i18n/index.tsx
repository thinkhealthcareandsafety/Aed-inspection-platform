'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en, type Messages } from './en';
import { hi } from './hi';

export type Lang = 'en' | 'hi';
export type { Messages };

const MESSAGES: Record<Lang, Messages> = { en, hi };
const STORAGE_KEY = 'aed_lang';

/**
 * The language the public flow is shown in. Held outside React as well so
 * non-component code (upload helpers, error mapping) can read it without
 * threading it through every call.
 */
let current: Lang = 'en';

export function getLang(): Lang {
  return current;
}

export function messagesFor(lang: Lang = current): Messages {
  return MESSAGES[lang];
}

function stored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' || v === 'hi' ? v : null;
  } catch {
    return null;
  }
}

function persist(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
}

/** A link can carry the language — the laptop-to-phone hand-off does, so
 *  the phone opens in the language the laptop was showing. Taken out of the
 *  address bar once read. */
function fromLink(): Lang | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('lang');
    if (v === null) return null;
    params.delete('lang');
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
    );
    return v === 'en' || v === 'hi' ? v : null;
  } catch {
    return null;
  }
}

/** A phone set to Hindi gets Hindi without having to find the switch. */
function detected(): Lang {
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  return langs.some((l) => l?.toLowerCase().startsWith('hi')) ? 'hi' : 'en';
}

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  m: Messages;
}

const I18nContext = createContext<I18nValue>({ lang: 'en', setLang: () => {}, m: en });

export function I18nProvider({ children }: { children: ReactNode }) {
  // Always English on the server and the first client render, so hydration
  // matches; the saved or detected language swaps in straight after.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const linked = fromLink();
    const initial = linked ?? stored() ?? detected();
    if (linked) persist(linked);
    current = initial;
    setLangState(initial);
  }, []);

  useEffect(() => {
    current = lang;
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    current = next;
    setLangState(next);
    persist(next);
  }, []);

  const value = useMemo(() => ({ lang, setLang, m: MESSAGES[lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/**
 * A check's name and instruction in the language showing, with the
 * instruction for the exact model when it differs — a ZOLL has no green
 * Ready light, an HS1's pads connect by cartridge.
 */
export function itemCopy(
  m: Messages,
  item: { id: string; title: string; description: string },
  aedModel?: string,
): { title: string; description: string } {
  const entry = m.items[item.id];
  return {
    title: entry?.title ?? item.title,
    description: (aedModel ? entry?.byModel?.[aedModel] : undefined) ?? entry?.description ?? item.description,
  };
}
