// 타이틀 배경: 도트 경기장 야경. 저해상도(TB_W x TB_H) 캔버스에 그려 CSS 로 확대한다.
import { createRng } from '../core/rng.js?v=1791280858';

export const TB_W = 120;
export const TB_H = 214;

const FLAG_Y = 36; // 깃발 줄 높이: 라켓 아이콘(위)과 로고(아래) 사이 빈 구간
const SKY = ['#070c18', '#0a1022', '#0e1530', '#131a3a', '#1a1f45', '#222450', '#2b2658']; // 위 → 아래 계단 그라데이션
const SHIRTS = ['#d94f4f', '#e8b83a', '#4a9de0', '#6fcf6f', '#c06be0', '#f0f0f0', '#ff8a3d'];
const SKINS = ['#f2c9a0', '#e0a97a', '#c68b5e', '#f7d7b5'];
const HAIR = ['#2a1d12', '#4a3320', '#111111', '#7a4a1e', '#8a8a95'];

const shade = (hex, k) => { // 어둡게(k<1)
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
};

/** ctx 에 배경을 그린다. 같은 seed → 같은 그림 (관중 배치 고정) */
export function drawTitleBackground(ctx, { seed = 7 } = {}) {
  const rng = createRng(seed);
  // 화면 밖에 완전히 벗어난 사각형은 그리지 않는다 (불필요한 호출 제거)
  const rect = (x, y, w, h, c) => {
    if (x >= TB_W || y >= TB_H || x + w <= 0 || y + h <= 0) return;
    ctx.fillStyle = c; ctx.fillRect(x, y, w, h);
  };

  // 1) 하늘/천장: 계단식 그라데이션
  const bandH = Math.ceil(122 / SKY.length);
  SKY.forEach((c, i) => rect(0, i * bandH, TB_W, bandH, c));
  // 별/조명 반짝임
  for (let i = 0; i < 26; i++) rect(Math.floor(rng.next() * TB_W), Math.floor(rng.next() * 40), 1, 1, i % 3 ? '#8b95c9' : '#ffffff');

  // 2) 스포트라이트 3개: 위에서 아래로 퍼지는 빛줄기 (스캔라인 디더)
  for (const cx of [18, 60, 102]) {
    rect(cx - 3, 0, 6, 3, '#3a3f66'); // 조명 기구
    rect(cx - 1, 3, 2, 1, '#ffe9a8');
    for (let y = 4; y < 124; y += 1) {
      const half = 2 + Math.floor(y * 0.30);
      ctx.fillStyle = y % 2 ? 'rgba(255,233,168,0.10)' : 'rgba(255,233,168,0.05)';
      ctx.fillRect(cx - half, y, half * 2, 1);
    }
  }

  // 3) 깃발 줄 (처진 줄 + 삼각 깃발)
  for (let x = 0; x < TB_W; x++) {
    const sag = Math.round(Math.sin((x / TB_W) * Math.PI * 3) * 3);
    rect(x, FLAG_Y + sag + 3, 1, 1, '#5a5f8a');
    if (x % 8 === 3) {
      const c = SHIRTS[(x / 8 | 0) % SHIRTS.length];
      rect(x - 1, FLAG_Y + sag + 4, 3, 1, c); rect(x - 1, FLAG_Y + sag + 5, 3, 1, c); rect(x, FLAG_Y + sag + 6, 1, 1, c);
    }
  }

  // 4) 관중석 벽
  rect(0, 70, TB_W, 56, '#0b0f1c');
  // 5) 관중 3열 (뒤 → 앞: 점점 크고 밝게)
  const rows = [
    { y: 72, step: 7, head: 3, body: 4, dark: 0.42 },
    { y: 86, step: 9, head: 4, body: 5, dark: 0.62 },
    { y: 102, step: 12, head: 5, body: 7, dark: 0.85 },
  ];
  rows.forEach((r, ri) => {
    for (let x = ((ri * 3) % r.step) - 2; x < TB_W + r.step; x += r.step) {
      const px = x + Math.floor(rng.signed() * 1.5);
      if (px + r.body + 2 <= 0 || px >= TB_W) continue; // 화면 밖 사람은 그리지 않음
      const shirt = shade(SHIRTS[Math.floor(rng.next() * SHIRTS.length)], r.dark);
      const skin = shade(SKINS[Math.floor(rng.next() * SKINS.length)], r.dark);
      const hair = shade(HAIR[Math.floor(rng.next() * HAIR.length)], r.dark);
      const up = rng.next() < 0.22 ? 3 + ri : 0; // 만세 하는 사람
      rect(px - 1, r.y + r.head, r.body + 2, r.body, shirt); // 어깨·몸
      rect(px, r.y, r.head, r.head, skin); // 머리
      rect(px, r.y, r.head, Math.max(1, r.head >> 1), hair); // 머리카락
      if (up) { rect(px - 1, r.y + r.head - up, 1, up, skin); rect(px + r.body, r.y + r.head - up, 1, up, skin); }
    }
    rect(0, r.y + r.head + r.body, TB_W, 2, shade('#1b2338', r.dark + 0.2)); // 난간
  });

  // 6) 경기장 바닥 + 원근선
  rect(0, 126, TB_W, TB_H - 126, '#16202f');
  for (let i = 0; i < 12; i++) {
    const fx = Math.round(60 + (i - 5.5) * 3); const tx = Math.round(60 + (i - 5.5) * 17);
    for (let y = 126; y < TB_H; y += 2) rect(Math.round(fx + ((tx - fx) * (y - 126)) / (TB_H - 126)), y, 1, 1, '#1d2a3d');
  }
  rect(0, 126, TB_W, 1, '#2a3a52');

  // 7) 탁구대 실루엣 (사다리꼴) + 네트 + 다리
  const top = 150; const bot = 186;
  for (let y = top; y < bot; y++) {
    const t = (y - top) / (bot - top);
    const half = Math.round(26 + t * 22);
    rect(60 - half, y, half * 2, 1, y % 2 ? '#0f5a3a' : '#0d4f33');
  }
  rect(34, top, 52, 1, '#bfe3cf'); // 앞쪽 끝 흰 테두리
  rect(60, top, 1, bot - top, '#7fb89a'); // 중앙선
  for (let x = 30; x <= 90; x += 2) rect(x, 166, 2, 3, x % 4 ? '#dfe6ec' : '#9aa6b2'); // 네트
  rect(28, 163, 2, 8, '#20252d'); rect(90, 163, 2, 8, '#20252d'); // 네트 기둥
  rect(34, bot, 3, 14, '#0a0e16'); rect(83, bot, 3, 14, '#0a0e16'); // 다리
  rect(18, bot, 84, 2, '#0a3a26'); // 앞쪽 두께

  // 8) 공 + 그림자
  rect(70, 158, 4, 1, 'rgba(0,0,0,0.35)');
  rect(69, 143, 4, 4, '#fff6d8'); rect(70, 144, 1, 1, '#ffffff');
  rect(69, 142, 4, 1, '#8a6a2a'); rect(69, 147, 4, 1, '#8a6a2a');

  // 9) 가장자리 비네트 (위·아래를 어둡게 해 로고와 버튼이 읽히게)
  for (let y = 0; y < 14; y++) rect(0, y, TB_W, 1, `rgba(5,8,16,${(0.55 * (14 - y)) / 14})`);
  for (let y = TB_H - 40; y < TB_H; y++) rect(0, y, TB_W, 1, `rgba(5,8,16,${(0.6 * (y - (TB_H - 40))) / 40})`);
}
