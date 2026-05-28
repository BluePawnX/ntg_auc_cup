/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Single accent — Valorant red — with hover/dim/soft variants for depth.
        accent: { DEFAULT: '#FF4655', hover: '#FF6470', dim: '#C8323F', soft: '#FF8A93' },
        ember: '#FF7A45', // warm partner for red→ember gradients
        ink: {
          950: '#06080C', // deepest backdrop
          900: '#0B0E13', // page
          800: '#11151C', // panels
          700: '#1A212B', // raised cards
          600: '#26303D', // borders / inputs
          500: '#3A4757',
        },
        muted: '#8A97A8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 28px -6px rgba(255,70,85,0.55)',
        glowsoft: '0 0 40px -10px rgba(255,70,85,0.35)',
        card: '0 18px 40px -20px rgba(0,0,0,0.75)',
        ring: '0 0 0 1px rgba(255,255,255,0.06), 0 18px 40px -22px rgba(0,0,0,0.8)',
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg, #FF4655 0%, #FF7A45 100%)',
        'accent-text': 'linear-gradient(135deg, #FF6470 0%, #FF9A5A 100%)',
        grid: 'linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(30px,-20px) scale(1.1)' }, '66%': { transform: 'translate(-20px,20px) scale(0.95)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        glowPulse: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,70,85,0.45)' }, '50%': { boxShadow: '0 0 0 12px rgba(255,70,85,0)' } },
        pulseRed: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,70,85,0.5)' }, '50%': { boxShadow: '0 0 0 10px rgba(255,70,85,0)' } },
      },
      animation: {
        fadeUp: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
        fadeIn: 'fadeIn 0.5s ease both',
        scaleIn: 'scaleIn 0.3s ease both',
        pop: 'scaleIn 140ms ease-out',
        float: 'float 6s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        glowPulse: 'glowPulse 1.4s ease-in-out infinite',
        pulseRed: 'pulseRed 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
