import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

type ThemeCtx = {
  theme: Theme;
  toggle: () => void;
};

const KEY = 'habitflow-theme';
const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} });

export const useTheme = () => useContext(Ctx);

function storedTheme(): Theme | null {
  try {
    const s = localStorage.getItem(KEY);
    return s === 'light' || s === 'dark' ? s : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0d15' : '#f6f7fa');
  }, [theme]);

  // Tant que l'utilisateur n'a pas choisi manuellement, on suit le système.
  useEffect(() => {
    if (storedTheme()) return;
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(m.matches ? 'dark' : 'light');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* stockage indisponible */
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}