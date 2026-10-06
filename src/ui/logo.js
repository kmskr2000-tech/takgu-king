// 타이틀 로고 '탁구왕 키우기' 도트 글자 (자작). 16x18 격자, 획 두께 2px.
// 글리프 = 사각형 목록 [x, y, w, h]. 자모를 조합해 직접 설계했다.
export const GLYPH_W = 16;
export const GLYPH_H = 18;

const ring = (x, y, w, h) => [ // 둥근 ㅇ: 모서리를 깎은 사각 고리 (획 2px)
  [x + 2, y, w - 4, 2], [x + 2, y + h - 2, w - 4, 2], [x, y + 2, 2, h - 4], [x + w - 2, y + 2, 2, h - 4],
];

export const GLYPHS = Object.freeze({
  탁: [
    // ㅌ (좌상): 위·가운데·아래 가로획 + 왼쪽 세로획
    [0, 0, 8, 2], [0, 4, 7, 2], [0, 8, 8, 2], [0, 0, 2, 10],
    // ㅏ
    [12, 0, 2, 10], [14, 4, 2, 2],
    // ㄱ (받침)
    [3, 12, 9, 2], [10, 12, 2, 5],
  ],
  구: [
    // ㄱ
    [2, 1, 11, 2], [11, 1, 2, 7],
    // ㅜ
    [1, 10, 14, 2], [7, 12, 2, 6],
  ],
  왕: [
    // ㅇ (초성)
    ...ring(1, 0, 8, 8),
    // ㅗ
    [4, 8, 2, 2], [1, 10, 9, 2],
    // ㅏ
    [12, 0, 2, 12], [14, 5, 2, 2],
    // ㅇ (받침)
    ...ring(3, 12, 10, 6),
  ],
  키: [
    // ㅋ: ㄱ + 가운데 가로획
    [1, 3, 9, 2], [8, 3, 2, 12], [1, 9, 8, 2],
    // ㅣ
    [12, 0, 2, 18],
  ],
  우: [
    // ㅇ
    ...ring(4, 0, 8, 8),
    // ㅜ
    [1, 10, 14, 2], [7, 12, 2, 6],
  ],
  기: [
    // ㄱ
    [1, 3, 9, 2], [8, 3, 2, 12],
    // ㅣ
    [12, 0, 2, 18],
  ],
});

export const LOGO_TEXT = '탁구왕 키우기';
const GAP = 2; // 글자 사이
const WORD_GAP = 6; // 띄어쓰기
const PAD = 2; // 외곽선·그림자 여백

/** 로고 전체 크기(격자 단위) */
export const LOGO_W = (() => {
  let w = 0;
  for (const ch of LOGO_TEXT) w += ch === ' ' ? WORD_GAP : GLYPH_W + GAP;
  return w - GAP + PAD * 2 + 1; // +1: 그림자
})();
export const LOGO_H = GLYPH_H + PAD * 2 + 1;

/** 각 글리프의 사각형(로고 좌표계, 여백 포함)을 순서대로 반환 */
export function layoutLogo() {
  const out = [];
  let x = PAD;
  for (const ch of LOGO_TEXT) {
    if (ch === ' ') { x += WORD_GAP; continue; }
    out.push({ ch, x, rects: GLYPHS[ch].map(([rx, ry, w, h]) => [x + rx, PAD + ry, w, h]) });
    x += GLYPH_W + GAP;
  }
  return out;
}

const COLORS = { outline: '#000000', shadow: '#8a5a00', top: '#ffe680', bottom: '#ffb300' };

/** 로고를 캔버스(논리 크기 LOGO_W x LOGO_H)에 그린다: 그림자 → 외곽선 → 2톤 채움. glyphCount 로 일부 글자만 그릴 수 있다 */
export function drawLogo(ctx, colors = COLORS, glyphCount = Infinity, firstGlyph = 0) {
  const glyphs = layoutLogo().slice(firstGlyph, glyphCount); // [firstGlyph, glyphCount) 글자만 (인트로: 글자별 등장·두 줄 배치)
  const rects = glyphs.flatMap((g) => g.rects);
  const paint = (color, dx, dy, grow = 0) => {
    ctx.fillStyle = color;
    for (const [x, y, w, h] of rects) ctx.fillRect(x + dx - grow, y + dy - grow, w + grow * 2, h + grow * 2);
  };
  paint(colors.shadow, 1, 1, 1); // 그림자(한 칸 아래·오른쪽, 외곽선 포함 두께)
  paint(colors.outline, 0, 0, 1); // 외곽선(상하좌우·대각 1칸)
  // 채움: 위쪽 절반은 밝게, 아래쪽 절반은 진하게 (2톤 도트 셰이딩)
  const mid = PAD + GLYPH_H / 2;
  for (const [x, y, w, h] of rects) {
    const topH = Math.max(0, Math.min(h, mid - y));
    if (topH > 0) { ctx.fillStyle = colors.top; ctx.fillRect(x, y, w, topH); }
    if (topH < h) { ctx.fillStyle = colors.bottom; ctx.fillRect(x, y + topH, w, h - topH); }
  }
}
