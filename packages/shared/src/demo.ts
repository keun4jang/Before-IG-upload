/**
 * 데모/샘플 데이터. API 키·DB 없이도 전체 플로우를 체험할 수 있게 합니다.
 * seed 스크립트와 in-memory 저장소에서 공유합니다.
 */

export interface DemoSlide {
  slideNumber: number;
  title: string;
  /** OCR 결과를 흉내낸 텍스트 (일부러 오타/중복/과장/사실검토 대상을 포함) */
  text: string;
}

export const DEMO_META = {
  name: '샘플 카드뉴스 — 건강 습관 5가지',
  description: '데모용 프로젝트입니다. 검수 결과 화면을 미리 볼 수 있어요.',
  notes: '실제 업로드 전, 이 샘플처럼 검수 결과를 확인하세요.',
};

export const DEMO_SLIDES: DemoSlide[] = [
  {
    slideNumber: 1,
    title: '건강 습관 5가지',
    text: '건강을 위한 습관 100% 완벽 정리\n지금부터 무조건 따라해보세요!!!',
  },
  {
    slideNumber: 2,
    title: '물 마시기',
    text: '하루 물 8잔을 마시면 신진대사가 30% 올라갑니다.\n디톡스 효과도 있습니다.',
  },
  {
    slideNumber: 3,
    title: '스트레칭',
    text: '매일 아침 스트레칭은 건강에 좋습니다.\n매일 아침 스트레칭은 건강에 좋습니다.',
  },
  {
    slideNumber: 4,
    title: '수면',
    text: '잠을 잘자면 면역력이 높아질수있다.\n하루 7시간 수면을 몇일만 지켜보세요.',
  },
  {
    slideNumber: 5,
    title: '마무리',
    text: '이 방법은 무조건 효과가 있습니다.\n건강한 습관, 오늘부터 시작해요.',
  },
];

export const DEMO_CAPTION = `건강 습관 5가지를 정리했어요 💪
하루 물 8잔, 스트레칭, 7시간 수면까지!
여러분의 건강 습관은 무엇인가요?

#건강 #건강습관 #건강 #다이어트 #운동 #자기계발 #건강관리 #다이어트`;

/** 슬라이드용 SVG placeholder 이미지를 data URL로 생성 (실제 업로드 없이 썸네일 표시). */
export function makePlaceholderImage(slideNumber: number, title: string): string {
  const palettes = [
    ['#eef2ff', '#c7d2fe', '#4f46e5'],
    ['#fdf2f8', '#fbcfe8', '#db2777'],
    ['#f0fdfa', '#99f6e4', '#0d9488'],
    ['#fefce8', '#fef08a', '#ca8a04'],
    ['#f5f3ff', '#ddd6fe', '#7c3aed'],
  ];
  const p = palettes[(slideNumber - 1) % palettes.length]!;
  const safeTitle = title.replace(/[<>&]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p[0]}"/>
      <stop offset="1" stop-color="${p[1]}"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#g)"/>
  <text x="72" y="140" font-family="sans-serif" font-size="40" fill="${p[2]}" opacity="0.8">Before IG Upload · 데모</text>
  <text x="72" y="560" font-family="sans-serif" font-size="96" font-weight="700" fill="${p[2]}">${safeTitle}</text>
  <text x="72" y="1000" font-family="sans-serif" font-size="48" fill="${p[2]}" opacity="0.6">Slide ${slideNumber}</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
