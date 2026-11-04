import defaultTheme from 'tailwindcss/defaultTheme'

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul Cobalto: cor de ação e identidade.
        brand: {
          DEFAULT: '#0038FF',
          50: '#EEF2FF',
          100: '#E3EAFF',
          200: '#C7D3FF',
          300: '#8CA6FF',
          400: '#5B7CFF',
          500: '#0038FF',
          600: '#002EDB',
          700: '#0026B3',
          800: '#001C85',
        },
        // Skin Sand: calor da marca. Entra em destaques pontuais, nunca em grandes áreas.
        sand: {
          DEFAULT: '#FFD8B8',
          50: '#FFF8F1',
          100: '#FFF0E3',
          200: '#FFE4CF',
          300: '#FFD8B8',
          400: '#F5BD92',
          600: '#B5601F',
          700: '#8A4410',
          800: '#6B3409',
        },
        // Grafite: navegação e superfícies escuras.
        graphite: {
          DEFAULT: '#14161B',
          950: '#0A0B0E',
          900: '#14161B',
          850: '#191C22',
          800: '#1F232B',
          700: '#2A2F39',
          600: '#3A4150',
          500: '#566070',
          400: '#8A91A0',
          300: '#B4BAC6',
          200: '#D5D8E0',
        },
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          raised: token('surface-raised'),
        },
        line: { DEFAULT: token('line'), strong: token('line-strong') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted'), subtle: token('fg-subtle') },
        // Texto de marca com contraste correto em cada tema (links, estados ativos).
        'brand-fg': token('brand-fg'),
        'brand-soft': token('brand-soft'),
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', ...defaultTheme.fontFamily.sans],
        display: ['"Bricolage Grotesque Variable"', '"Hanken Grotesk Variable"', ...defaultTheme.fontFamily.sans],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1.0625rem' }],
        sm: ['0.875rem', { lineHeight: '1.3125rem' }],
        base: ['0.9375rem', { lineHeight: '1.5rem' }],
        title: ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }],
        display: ['2.75rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
      },
      borderRadius: {
        control: '0.5rem',
        card: '0.875rem',
        pop: '0.75rem',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        focus: '0 0 0 3px rgb(var(--ring) / 0.28)',
      },
      transitionDuration: { 120: '120ms' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': { from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in 140ms ease-out',
        'pop-in': 'pop-in 140ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'slide-in': 'slide-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
