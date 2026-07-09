import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 포인트 컬러: blue-violet 계열
        // SMCC 운영툴 키 컬러
        smcc: {
          50: '#e8f9fc',
          100: '#c9f1f7',
          200: '#95e4ef',
          300: '#5cd3e5',
          400: '#22bcd6',
          500: '#00b1cd',
          600: '#0090a8',
          700: '#017085',
          800: '#08596a',
          900: '#0c4a59',
        },
        // 포인트 컬러(라벤더 → 틸): #CCABD8 #8474A1 #6EC6CA #08979D #055B5C
        brand: {
          50: '#eafbfb',
          100: '#d2f4f4',
          200: '#a6e9ea',
          300: '#6ec6ca',
          400: '#3aa9ad',
          500: '#08979d',
          600: '#08979d',
          700: '#067579',
          800: '#055b5c',
          900: '#043f40',
          950: '#022b2c',
        },
        accent: {
          100: '#f2e9f6',
          200: '#e3d2ec',
          300: '#ccabd8',
          400: '#a98fc0',
          500: '#8474a1',
          600: '#6b5c86',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard',
          'Pretendard Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
