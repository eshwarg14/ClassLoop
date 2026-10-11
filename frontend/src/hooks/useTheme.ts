import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeToDOM(resolved: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => {
      // Set up media query listener for system theme changes
      if (typeof window !== 'undefined') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          if (get().theme === 'system') {
            const newResolved = e.matches ? 'dark' : 'light';
            applyThemeToDOM(newResolved);
            set({ resolvedTheme: newResolved });
          }
        });
      }

      return {
        theme: 'dark',
        resolvedTheme: 'dark',
        setTheme: (theme: Theme) => {
          const resolved = theme === 'system' ? getSystemTheme() : theme;
          applyThemeToDOM(resolved);
          set({ theme, resolvedTheme: resolved });
        },
        toggleTheme: () => {
          const current = get().resolvedTheme;
          const next = current === 'dark' ? 'light' : 'dark';
          applyThemeToDOM(next);
          set({ theme: next, resolvedTheme: next });
        },
      };
    },
    {
      name: 'classloop-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = state.theme === 'system' ? getSystemTheme() : state.theme;
          applyThemeToDOM(resolved);
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);
