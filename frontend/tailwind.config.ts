import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // AED status colours
        status: {
          pass: '#16a34a',
          fail: '#dc2626',
          review: '#d97706',
          unknown: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Geist', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'Geist', 'sans-serif'],
        mono: ['var(--font-mono)', 'Geist Mono', 'monospace'],
      },
      /* One type scale for the whole product. Optical tracking tightens as
         size grows, the way a type designer would set it — ad-hoc sizes
         (10.5, 11.5, 12.5…) are what made the old UI read as unpolished. */
      fontSize: {
        caption: ['0.6875rem', { lineHeight: '1.35', letterSpacing: '0.005em', fontWeight: '500' }],
        footnote: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0em' }],
        callout: ['0.8125rem', { lineHeight: '1.45', letterSpacing: '-0.003em' }],
        body: ['0.9375rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        headline: ['1.0625rem', { lineHeight: '1.35', letterSpacing: '-0.016em', fontWeight: '600' }],
        title: ['1.375rem', { lineHeight: '1.25', letterSpacing: '-0.021em', fontWeight: '600' }],
        display: ['1.75rem', { lineHeight: '1.15', letterSpacing: '-0.026em', fontWeight: '600' }],
        'display-lg': ['2.125rem', { lineHeight: '1.08', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.08)', opacity: '0.7' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        'slide-up': {
          from: { transform: 'translateY(12px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'blink': 'blink 1.2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'scan-line': 'scan-line 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
