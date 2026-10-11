import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        raised: 'var(--color-raised)',
        border: 'var(--color-border)',
        foreground: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: {
          DEFAULT: '#6C7BFF',
          hover: '#5A69FF',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#2DD4BF',
          hover: '#14B8A6',
          foreground: '#0B1020',
        },
        confusion: {
          calm: '#2DD4BF',     // low confusion
          warning: '#F5B84B',  // medium confusion
          danger: '#FF6B6B',   // high confusion
        },
        observatory: {
          dark: {
            bg: '#0B1020',
            surface: '#121A33',
            raised: '#1A2447',
            border: '#26325C',
            text: '#E8ECFF',
            muted: '#8B96C4',
          },
          light: {
            bg: '#F6F7FB',
            surface: '#FFFFFF',
            raised: '#EEF1FA',
            border: '#DCE1F0',
            text: '#12172B',
            muted: '#5B6488',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'fade-out': 'fadeOut 0.25s ease-in',
        'scale-in': 'scaleIn 0.2s ease-out',
        'waveform': 'waveform 1.2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 15px rgba(108, 123, 255, 0.4)',
          },
          '50%': {
            opacity: '0.6',
            boxShadow: '0 0 5px rgba(108, 123, 255, 0.1)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(4px)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        waveform: {
          '0%, 100%': { height: '6px' },
          '50%': { height: '28px' },
        },
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(108, 123, 255, 0.2)',
        'glow-md': '0 0 20px rgba(108, 123, 255, 0.3)',
        'glow-lg': '0 0 30px rgba(108, 123, 255, 0.4)',
        'glow-calm': '0 0 15px rgba(45, 212, 191, 0.3)',
        'glow-warning': '0 0 15px rgba(245, 184, 75, 0.3)',
        'glow-danger': '0 0 15px rgba(255, 107, 107, 0.3)',
      },
    },
  },
  plugins: [],
};

export default config;
