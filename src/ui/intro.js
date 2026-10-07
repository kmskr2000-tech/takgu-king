// 인트로: "지면 다시" 4장면 (패배 → 다짐 → 랠리 → 로고). 장면은 시간 t(초)만 받는 순수 함수라 결정적이고 테스트 가능하다.
// 화면비에 따라 캔버스가 cover 로 잘리므로 핵심 콘텐츠는 안전영역 x 14~106, y 22~192 안에 둔다.
export const SAFE = Object.freeze({ x0: 14, x1: 106, y0: 22, y1: 192 });
import { SPRITES, PALETTES, BALL, BALL_PALETTE, drawSprite } from './sprites.js?v=1791365283';
import { drawLogo, layoutLogo, LOGO_H } from './logo.js?v=1791365283';

export const INTRO_W = 120;
export const INTRO_H = 214;
export const INTRO_DURATION = 6.6;

export const SCENES = Object.freeze([
  { id: 'defeat', start: 0, end: 1.8 },
  { id: 'resolve', start: 1.8, end: 3.6 },
  { id: 'rally', start: 3.6, end: 5.4 },
  { id: 'logo', start: 5.4, end: INTRO_DURATION },
]);

export const CAPTIONS = Object.freeze([
  { text: '또… 졌다.', start: 0.5, end: 1.8, cps: 9 },
  { text: '지면, 다시.', start: 2.0, end: 3.6, cps: 8 },
  { text: '한 점씩, 한 경기씩.', start: 3.7, end: 5.4, cps: 11 },
]);

export const sceneAt = (t) => SCENES.find((s) => t >= s.start && t < s.end) ?? SCENES[SCENES.length - 1];

/** 시각 t 의 자막. 글자가 하나씩 나타난다(타이핑). 없으면 null */
export function captionAt(t) {
  const c = CAPTIONS.find((x) => t >= x.start && t < x.end);
  if (!c) return null;
  const n = Math.min(c.text.length, Math.floor((t - c.start) * c.cps) + 1);
  return { text: c.text.slice(0, n), full: c.text, done: n >= c.text.length };
}

/** 검은 페이드 (처음 0.4초 페이드인, 마지막 0.3초 페이드아웃) → 알파 0..1 */
export function fadeAlpha(t) {
  if (t < 0.4) return 1 - t / 0.4;
  if (t >= INTRO_DURATION) return 1; // 부동소수 오차로 0.9999… 가 되지 않게 끝 시각은 정확히 1
  if (t > INTRO_DURATION - 0.3) return Math.min(1, (t - (INTRO_DURATION - 0.3)) / 0.3);
  return 0;
}

// ---- 도트 숫자 (3x5) : 전광판용 ----
const DIGITS = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], ':': ['0', '1', '0', '1', '0'],
};
export function drawDigits(ctx, text, x, y, color, s = 2) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = DIGITS[ch];
    if (!g) continue;
    g.forEach((row, j) => [...row].forEach((bit, i) => { if (bit === '1') ctx.fillRect(cx + i * s, y + j * s, s, s); }));
    cx += (g[0].length + 1) * s;
  }
  return cx - x;
}

const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const ease = (k) => k * k * (3 - 2 * k);

function backdrop(ctx, light) { // light 0..1: 밤하늘 계단 그라데이션 + 바닥
  const bands = ['#05070d', '#070b16', '#0a1022', '#0e1530', '#131a3a'];
  bands.forEach((c, i) => rect(ctx, 0, i * 30, INTRO_W, 30, c));
  rect(ctx, 0, 150, INTRO_W, INTRO_H - 150, '#0e1520');
  rect(ctx, 0, 150, INTRO_W, 1, '#1e2c44');
  for (let i = 0; i < 24; i++) rect(ctx, (i * 53) % INTRO_W, (i * 37) % 70, 1, 1, i % 3 ? '#39406e' : '#8b95c9'); // 별/먼지
  void light;
}

function spotlight(ctx, cx, strength) { // 위에서 퍼지는 빛줄기 (스캔라인)
  if (strength <= 0) return;
  rect(ctx, cx - 3, 0, 6, 3, '#3a3f66');
  for (let y = 4; y < 150; y++) {
    const half = 2 + Math.floor(y * 0.28);
    ctx.fillStyle = `rgba(255,233,168,${((y % 2 ? 0.13 : 0.06) * strength).toFixed(3)})`;
    ctx.fillRect(cx - half, y, half * 2, 1);
  }
}

function crowdSilhouette(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(6,9,18,${alpha.toFixed(3)})`;
  for (let x = 2; x < INTRO_W; x += 9) { ctx.fillRect(x, 118, 5, 5); ctx.fillRect(x - 1, 123, 7, 8); }
  ctx.fillRect(0, 131, INTRO_W, 3);
}

function sceneDefeat(ctx, t) {
  backdrop(ctx, 0);
  spotlight(ctx, 60, 0.7);
  // 전광판
  rect(ctx, 30, 24, 60, 26, '#0a0d14'); rect(ctx, 30, 24, 60, 1, '#39406e'); rect(ctx, 30, 49, 60, 1, '#39406e');
  rect(ctx, 30, 24, 1, 26, '#39406e'); rect(ctx, 89, 24, 1, 26, '#39406e');
  const blink = Math.floor(t * 2.5) % 2 === 0;
  drawDigits(ctx, '3', 38, 31, '#6fcf6f');
  drawDigits(ctx, ':', 52, 31, '#8d98a5');
  drawDigits(ctx, '11', 60, 31, blink ? '#ff5a4a' : '#a83a30');
  // 고개 숙인 선수 (뒷모습, 살짝 아래로)
  const sink = Math.min(1, t / 0.9) * 3;
  drawSprite(ctx, SPRITES.me[0], PALETTES.me, 42, 100 + Math.round(sink), { scale: 3 });
  rect(ctx, 40, 152, 40, 2, '#05070d'); // 그림자
}

function sceneResolve(ctx, t) {
  const u = t - 1.8;
  backdrop(ctx, u / 1.8);
  crowdSilhouette(ctx, lerp(0, 0.85, u / 1.2));
  const s = lerp(0.7, 1, u / 1.4);
  spotlight(ctx, 20, s * 0.5); spotlight(ctx, 60, s); spotlight(ctx, 100, s * 0.5);
  const frame = u < 0.6 ? 0 : u < 1.1 ? 1 : 2; // 서 있다 → 라켓을 쥔다 → 스윙
  const lift = u < 0.6 ? 2 - Math.round((u / 0.6) * 2) : 0;
  drawSprite(ctx, SPRITES.me[frame], PALETTES.me, 42, 100 + lift, { scale: 3 });
  rect(ctx, 40, 152, 40, 2, '#05070d');
  if (u >= 0.6) { // 느낌표 반짝임
    const pop = Math.floor((u - 0.6) * 12) % 2 === 0;
    rect(ctx, 86, 92, 3, 9, pop ? '#ffd24a' : '#fff6d8'); rect(ctx, 86, 103, 3, 3, pop ? '#ffd24a' : '#fff6d8');
  }
  if (frame === 2) for (let i = 0; i < 4; i++) rect(ctx, 76 + i * 4, 104 + i * 3, 3, 1, 'rgba(255,255,255,0.7)'); // 스윙 궤적
}

const HIT_EVERY = 0.45;
const RALLY_TOP = 62; const RALLY_BOTTOM = 150;
function sceneRally(ctx, t) {
  const u = t - 3.6;
  backdrop(ctx, 1);
  crowdSilhouette(ctx, 0.35);
  spotlight(ctx, 20, 0.8); spotlight(ctx, 60, 1); spotlight(ctx, 100, 0.8);
  // 탁구대 (위에서 본 모습)
  rect(ctx, 24, RALLY_TOP, 72, RALLY_BOTTOM - RALLY_TOP, '#0d4f33');
  rect(ctx, 26, RALLY_TOP + 2, 68, RALLY_BOTTOM - RALLY_TOP - 4, '#1f7a4d');
  rect(ctx, 60, RALLY_TOP + 2, 1, RALLY_BOTTOM - RALLY_TOP - 4, '#bfe3cf');
  const ny = Math.round((RALLY_TOP + RALLY_BOTTOM) / 2);
  for (let x = 22; x < 98; x += 2) rect(ctx, x, ny - 1, 2, 3, x % 4 ? '#dfe6ec' : '#9aa6b2');
  // 랠리: 타격마다 방향이 바뀌고 좌우로 오간다
  const k = Math.floor(u / HIT_EVERY); const f = (u - k * HIT_EVERY) / HIT_EVERY;
  const fromTop = k % 2 === 0;
  const xs = [48, 72, 54, 70, 50, 66];
  const x0 = xs[k % xs.length]; const x1 = xs[(k + 1) % xs.length];
  const yA = fromTop ? RALLY_TOP + 6 : RALLY_BOTTOM - 6; const yB = fromTop ? RALLY_BOTTOM - 6 : RALLY_TOP + 6;
  const bx = Math.round(lerp(x0, x1, f)); const by = Math.round(lerp(yA, yB, f));
  const z = Math.round(Math.sin(Math.PI * f) * 12);
  // 선수 (스윙 직후 0.13초 동안 타격 프레임)
  const swing = (side) => ((side === 'top') === fromTop && f < 0.3 ? 2 : (side === 'top') !== fromTop && f > 0.75 ? 1 : 0);
  drawSprite(ctx, SPRITES.opp[swing('top')], PALETTES.opp, Math.round(x0 - 6), RALLY_TOP - 36, { scale: 2 });
  drawSprite(ctx, SPRITES.me[swing('bottom')], PALETTES.me, Math.round(x1 - 6), RALLY_BOTTOM + 4, { scale: 2 });
  // 공 + 그림자 + 잔상
  for (let i = 3; i >= 1; i--) { const ff = Math.max(0, f - i * 0.06); rect(ctx, Math.round(lerp(x0, x1, ff)), Math.round(lerp(yA, yB, ff)) - Math.round(Math.sin(Math.PI * ff) * 12), 2, 2, 'rgba(255,210,74,0.45)'); }
  rect(ctx, bx - 2, by + 1, 5, 2, 'rgba(0,0,0,0.35)');
  drawSprite(ctx, BALL, BALL_PALETTE, bx - 2, by - z - 2);
  // 타격 스파크 (타격 직후 0.15초)
  if (f < 0.33) {
    const sx = x0; const sy = yA; const r = 2 + Math.round(f * 14);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rect(ctx, Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 2, 2, i % 2 ? '#ffd24a' : '#ffffff'); }
  }
}

function offset(ctx, dx, dy) { // drawLogo 가 절대 좌표를 쓰므로 원점을 옮겨 주는 얇은 래퍼
  return { set fillStyle(v) { ctx.fillStyle = v; }, get fillStyle() { return ctx.fillStyle; }, fillRect: (x, y, w, h) => ctx.fillRect(x + dx, y + dy, w, h) };
}

function sceneLogo(ctx, t) {
  const u = t - 5.4;
  backdrop(ctx, 1);
  crowdSilhouette(ctx, 0.5);
  spotlight(ctx, 20, 1); spotlight(ctx, 60, 1); spotlight(ctx, 100, 1);
  // 두 줄 로고: 탁구왕 / 키우기 (좁은 폰 화면에서도 잘리지 않게). 0.1초마다 한 글자씩 등장
  const n = Math.min(layoutLogo().length, Math.floor(u / 0.1) + 1);
  const lay = layoutLogo();
  const rowW = lay[2].x + 16 + 2 - lay[0].x; // 한 줄(3글자) 폭
  const lx = Math.round((INTRO_W - rowW) / 2) - lay[0].x + 2;
  const ly = 70;
  drawLogo(offset(ctx, lx, ly), undefined, Math.min(n, 3), 0);
  drawLogo(offset(ctx, lx - (lay[3].x - lay[0].x), ly + LOGO_H + 4), undefined, n, 3);
  // 로고 아래 반짝이
  for (let i = 0; i < 6; i++) {
    const on = Math.floor(u * 8 + i) % 3 === 0;
    if (on) rect(ctx, 20 + i * 16, ly + LOGO_H * 2 + 16 + ((i * 7) % 9), 2, 2, i % 2 ? '#ffd24a' : '#ffffff');
  }
  if (u < 0.25) { ctx.fillStyle = `rgba(255,255,255,${(1 - u / 0.25).toFixed(3)})`; ctx.fillRect(0, 0, INTRO_W, INTRO_H); } // 섬광
}

const DRAWERS = { defeat: sceneDefeat, resolve: sceneResolve, rally: sceneRally, logo: sceneLogo };

/** 시각 t 의 한 프레임을 그린다 (순수: 같은 t → 같은 그림) */
export function drawIntro(ctx, t) {
  const tt = Math.max(0, Math.min(INTRO_DURATION, t));
  DRAWERS[sceneAt(tt).id](ctx, tt);
  const a = fadeAlpha(tt);
  if (a > 0) { ctx.fillStyle = `rgba(7,12,24,${a.toFixed(3)})`; ctx.fillRect(0, 0, INTRO_W, INTRO_H); }
}

/** 인트로 진행 제어: update(t) 로 시간 전달, skip() 으로 건너뜀. onDone 은 정확히 1번 */
export function createIntroController({ duration = INTRO_DURATION, onDone = () => {} } = {}) {
  let done = false;
  const finish = (skipped) => { if (done) return false; done = true; onDone({ skipped }); return true; };
  return {
    get done() { return done; },
    update(t) { if (!done && t >= duration) finish(false); return done; },
    skip() { return finish(true); },
  };
}
