// 새 게임 시작 전 도민구 소개 컷신: 도트 컷 5장 + 자막(나레이션·독백·오순자의 대사). 컷은 (컷 번호, 컷 안 시간 u)만 받는 순수 함수라 결정적이고 테스트 가능하다.
// 흐름: 새벽 탁구장 벽치기 → 10년 후보 인생 → 물류센터 야간 알바 → 오순자의 대회 권유 → "…다시." (출처: files/스토리라인.md §1)
// 탭 = 다음 줄(타이핑 중이면 먼저 끝까지 표시), 건너뛰기 = 전부 넘김. 핵심 그림은 안전영역(SAFE) 안, 자막은 화면 아래쪽에 겹쳐 뜨므로 그림은 y 150 위쪽에 둔다.
import { SPRITES, PALETTES, BALL, BALL_PALETTE, drawSprite } from './sprites.js?v=1791360768';
import { INTRO_W, INTRO_H, drawDigits } from './intro.js?v=1791360768';

export { INTRO_W, INTRO_H };
export const CPS = 16; // 자막 타이핑 속도(글자/초)
export const HOLD = 0.9; // 다 쳐진 뒤 머무는 시간(초)
export const CUT_FADE_IN = 0.35; export const CUT_FADE_OUT = 0.25;

/** kind: 'n' 나레이션 / 'm' 도민구 독백 / 's' 다른 인물의 말(who 표시) */
export const CUTS = Object.freeze([
  { id: 'wall', lines: [
    { kind: 'n', text: '새벽 4시. 새마을 탁구장 구석.' },
    { kind: 'm', text: '벽은 이기지도, 지지도 않아서 좋아.' },
  ] },
  { id: 'bench', lines: [
    { kind: 'n', text: '중학교 탁구부 3년, 시합엔 한 번도 못 나갔다.' },
    { kind: 'n', text: '입시도, 취업도, 연애도 줄줄이 떨어졌다.' },
  ] },
  { id: 'night', lines: [
    { kind: 'n', text: '스물아홉, 물류센터 야간 상하차. 퇴근하면 벽 앞에 선다. 10년째.' },
  ] },
  { id: 'offer', lines: [
    { kind: 's', who: '오순자', text: '벽이랑은 이제 그만 놀고, 사람이랑 쳐 봐.' },
    { kind: 'n', text: '10년 동안 지켜본 사람이 아마추어 대회 신청서를 내밀었다.' },
  ] },
  { id: 'resolve', lines: [
    { kind: 'm', text: '…다시.' },
    { kind: 'n', text: '도민구, 29세. 별명, 벽치기.' },
  ] },
]);

const lineDur = (l) => l.text.length / CPS;

/** 모든 줄을 이어 붙인 타임라인: [{cut, idx, kind, who, text, start, typeEnd, end}] + 컷별 구간 */
export function buildTimeline(cuts = CUTS) {
  const segs = []; const spans = []; let t = 0;
  cuts.forEach((c, ci) => {
    const s0 = t;
    c.lines.forEach((l, idx) => {
      const start = t; const typeEnd = start + lineDur(l); const end = typeEnd + HOLD;
      segs.push({ cut: ci, idx, kind: l.kind, who: l.who ?? null, text: l.text, start, typeEnd, end });
      t = end;
    });
    spans.push({ id: c.id, start: s0, end: t });
  });
  return { segs, spans, total: t };
}
export const TIMELINE = buildTimeline();
export const STORY_INTRO_DURATION = TIMELINE.total;

export const cutIndexAt = (t, tl = TIMELINE) => { const i = tl.spans.findIndex((s) => t >= s.start && t < s.end); return i < 0 ? tl.spans.length - 1 : i; };

/** 시각 t 의 자막: 타이핑 중인 줄(글자 단위). 없으면 null */
export function captionAt(t, tl = TIMELINE) {
  const s = tl.segs.find((x) => t >= x.start && t < x.end);
  if (!s) return null;
  const n = Math.min(s.text.length, Math.floor((t - s.start) * CPS) + 1);
  return { text: s.text.slice(0, n), full: s.text, done: n >= s.text.length, kind: s.kind, who: s.who, cut: s.cut };
}

/** 컷 안의 검은 페이드 알파 (컷 처음 CUT_FADE_IN 동안 밝아지고, 컷 끝 CUT_FADE_OUT 동안 어두워진다) */
export function cutFade(t, tl = TIMELINE) {
  const sp = tl.spans[cutIndexAt(t, tl)]; const u = t - sp.start; const left = sp.end - t;
  if (u < CUT_FADE_IN) return 1 - u / CUT_FADE_IN;
  if (left < CUT_FADE_OUT) return Math.min(1, 1 - left / CUT_FADE_OUT);
  return 0;
}

// ---------- 그리기 ----------
const rect = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const tri = (f) => 1 - Math.abs(2 * (f - Math.floor(f)) - 1); // 0→1→0 삼각파

function gymBackdrop(ctx, warm = 0) { // 새벽 체육관: 어두운 벽 + 바닥 (warm 0..1 이면 따뜻한 조명)
  const top = warm ? ['#2a2118', '#32271b', '#3a2d1f'] : ['#05070d', '#070b16', '#0a1022'];
  top.forEach((c, i) => rect(ctx, 0, i * 36, INTRO_W, 36, c));
  rect(ctx, 0, 108, INTRO_W, INTRO_H - 108, warm ? '#2b2118' : '#0e1520');
  rect(ctx, 0, 108, INTRO_W, 1, warm ? '#5a4630' : '#1e2c44');
}
function lamp(ctx, cx, strength = 1, y0 = 0, y1 = 112) { // 천장 전등 + 빛줄기
  rect(ctx, cx - 1, 0, 2, y0 + 6, '#3a3f66'); rect(ctx, cx - 4, y0 + 6, 8, 3, '#8b95c9');
  for (let y = y0 + 9; y < y1; y++) {
    const half = 3 + Math.floor((y - y0) * 0.32);
    ctx.fillStyle = `rgba(255,233,168,${((y % 2 ? 0.12 : 0.05) * strength).toFixed(3)})`;
    ctx.fillRect(cx - half, y, half * 2, 1);
  }
}
const shadow = (ctx, x, y, w) => rect(ctx, x, y, w, 2, 'rgba(0,0,0,0.45)');

function cutWall(ctx, u) { // 새벽 4시, 벽치기: 벽 ↔ 공 ↔ 도민구
  gymBackdrop(ctx); lamp(ctx, 60, 0.8);
  rect(ctx, 12, 30, 96, 80, '#2c3147'); // 벽
  for (let y = 30; y < 110; y += 8) { rect(ctx, 12, y, 96, 1, '#222638'); for (let x = 12 + ((y / 8) % 2) * 8; x < 108; x += 16) rect(ctx, x, y, 1, 8, '#222638'); }
  for (let i = 0; i < 40; i++) rect(ctx, 46 + ((i * 7) % 28), 54 + ((i * 11) % 24), 2, 2, i % 3 ? '#3a4262' : '#4a5478'); // 10년 맞아 닳은 자국
  drawDigits(ctx, '04:12', 76, 14, '#ff5a4a', 2); // 새벽 4시 12분
  const f = (u * 2.2) % 1; const toWall = Math.floor(u * 2.2) % 2 === 0; // 벽에 맞고 돌아오는 공
  const by = Math.round(lerp(toWall ? 112 : 66, toWall ? 66 : 112, f)); const bx = Math.round(lerp(toWall ? 58 : 60, toWall ? 60 : 58, f));
  const swing = !toWall && f > 0.8 ? 2 : toWall && f < 0.15 ? 1 : 0;
  drawSprite(ctx, SPRITES.me[swing], PALETTES.me, 42, 104, { scale: 3 }); shadow(ctx, 40, 152, 40);
  drawSprite(ctx, BALL, BALL_PALETTE, bx - 2, by - 8 - Math.round(Math.sin(Math.PI * f) * 6));
  if ((toWall && f > 0.9) || (!toWall && f < 0.1)) for (let i = 0; i < 6; i++) rect(ctx, 56 + ((i * 5) % 14), 62 + (i % 3) * 3, 2, 2, '#ffd24a'); // 벽에 맞는 순간 스파크
}

function cutBench(ctx, u) { // 10년 후보 인생: 벤치에 앉은 후보 + 떨어지는 탈락 통지서
  gymBackdrop(ctx); lamp(ctx, 90, 0.7);
  for (let i = 0; i < 3; i++) { // 코트 위에서 치는 동료들(작게, 뒤쪽)
    const x = 22 + i * 30; drawSprite(ctx, SPRITES.opp[Math.floor(u * 3 + i) % 3], PALETTES.opp, x, 40, { scale: 2 });
  }
  rect(ctx, 6, 118, 64, 4, '#6b4a2a'); rect(ctx, 10, 122, 3, 14, '#4a3320'); rect(ctx, 62, 122, 3, 14, '#4a3320'); // 벤치
  drawSprite(ctx, SPRITES.me[0], PALETTES.me, 26, 82 + Math.round(Math.sin(u * 2) * 0.6), { scale: 3 }); // 고개 숙인 후보
  rect(ctx, 30, 96, 10, 7, '#f4f4f4'); drawDigits(ctx, '0', 33, 97, '#14110f', 1); // 후보 번호표(0번)
  for (let i = 0; i < 3; i++) { // 입시 · 취업 · 연애: 통지서가 차례로 떨어지고 빨간 X
    const t0 = 0.5 + i * 1.1; if (u < t0) continue;
    const k = Math.min(1, (u - t0) / 0.5); const px = 76 + (i % 2) * 14 - 6 + i * 3; const py = Math.round(lerp(10, 36 + i * 24, k * k));
    rect(ctx, px, py, 24, 18, '#f4f4f4'); rect(ctx, px, py, 24, 1, '#cfd6dd');
    for (let j = 0; j < 3; j++) rect(ctx, px + 3, py + 4 + j * 3, 14 - j * 3, 1, '#9aa4ae');
    if (k >= 1) for (let d = 0; d < 9; d++) { rect(ctx, px + 8 + d, py + 2 + d, 2, 2, '#e03a3a'); rect(ctx, px + 16 - d, py + 2 + d, 2, 2, '#e03a3a'); }
  }
}

function cutNight(ctx, u) { // 물류센터 야간 알바: 박스 쌓인 선반 + 컨베이어 + 박스 든 도민구
  rect(ctx, 0, 0, INTRO_W, INTRO_H, '#0a0e14'); rect(ctx, 0, 112, INTRO_W, INTRO_H - 112, '#161c26'); rect(ctx, 0, 112, INTRO_W, 1, '#2a3446');
  rect(ctx, 88, 14, 12, 12, '#dfe6ec'); rect(ctx, 91, 14, 9, 12, '#0a0e14'); // 달
  for (let r = 0; r < 3; r++) { // 선반
    rect(ctx, 4, 36 + r * 24, 52, 2, '#46556e');
    for (let b = 0; b < 3; b++) { const bw = 12 + ((b + r) % 2) * 3; rect(ctx, 6 + b * 16, 36 + r * 24 - 16, bw, 16, '#a9783f'); rect(ctx, 6 + b * 16, 36 + r * 24 - 16, bw, 2, '#c99a5f'); rect(ctx, 6 + b * 16 + 5, 36 + r * 24 - 16, 2, 16, '#7a5527'); }
  }
  rect(ctx, 8, 120, 104, 6, '#2a3446'); // 컨베이어
  for (let i = 0; i < 14; i++) rect(ctx, 8 + ((i * 8 + Math.floor(u * 24)) % 104), 120, 2, 6, '#46556e');
  for (let i = 0; i < 3; i++) { const bx = 8 + ((i * 36 + Math.floor(u * 20)) % 96); rect(ctx, bx, 108, 14, 12, '#a9783f'); rect(ctx, bx, 108, 14, 2, '#c99a5f'); }
  const bob = Math.round(Math.sin(u * 5) * 1);
  drawSprite(ctx, SPRITES.me[0], PALETTES.me, 70, 86 + bob, { scale: 3 }); shadow(ctx, 68, 134, 40);
  rect(ctx, 66, 70 + bob, 22, 14, '#d9a05b'); rect(ctx, 66, 70 + bob, 22, 2, '#f0c27f'); rect(ctx, 76, 70 + bob, 2, 14, '#a9783f'); // 머리 위 박스(선반 박스와 구분되게 밝은 색)
  drawDigits(ctx, '02:00', 66, 150, '#6fcf6f', 2); // 야간 근무
}

function cutOffer(ctx, u) { // 오순자의 권유: 신청서를 내미는 오순자 + 도민구
  gymBackdrop(ctx, 1); lamp(ctx, 60, 1);
  rect(ctx, 6, 100, 108, 22, '#1f7a4d'); rect(ctx, 6, 100, 108, 2, '#bfe3cf'); rect(ctx, 6, 122, 108, 3, '#0d4f33'); // 탁구대
  drawSprite(ctx, SPRITES.me[0], PALETTES.me, 12, 68, { scale: 3 }); shadow(ctx, 10, 116, 40);
  drawSprite(ctx, SPRITES.opp[0], PALETTES.opp, 70, 62, { scale: 3 }); // 오순자(백발)
  rect(ctx, 78, 62, 20, 3, '#e8e8f0'); // 파마머리 볼륨
  for (let i = 0; i < 3; i++) { rect(ctx, 96 + i * 5, 106 - (i % 2) * 2, 4, 4, '#ff9a2a'); rect(ctx, 97 + i * 5, 105 - (i % 2) * 2, 2, 1, '#6fcf6f'); } // 귤
  const k = Math.min(1, u / 1.4); const px = Math.round(lerp(74, 46, k)); const py = Math.round(lerp(88, 80, k)) + Math.round(Math.sin(u * 4) * 0.8);
  rect(ctx, px, py, 18, 24, '#f4f4f4'); rect(ctx, px, py, 18, 2, '#e03a3a');
  for (let j = 0; j < 5; j++) rect(ctx, px + 3, py + 6 + j * 3, 12 - (j % 2) * 4, 1, '#9aa4ae'); // 신청서
  if (k >= 1 && Math.floor(u * 6) % 2 === 0) { rect(ctx, 28, 58, 3, 9, '#ffd24a'); rect(ctx, 28, 69, 3, 3, '#ffd24a'); } // 도민구의 '!' 
}

function cutResolve(ctx, u) { // "…다시.": 스포트라이트 아래 신청서를 쥔 도민구, 스윙
  gymBackdrop(ctx); lamp(ctx, 20, 0.5); lamp(ctx, 60, 1); lamp(ctx, 100, 0.5);
  const frame = u < 0.8 ? 0 : u < 1.4 ? 1 : 2;
  drawSprite(ctx, SPRITES.me[frame], PALETTES.me, 42, 96 - (u < 0.8 ? Math.round(u * 2) : 2), { scale: 3 }); shadow(ctx, 40, 148, 40);
  if (u < 1.4) { rect(ctx, 80, 104, 14, 18, '#f4f4f4'); rect(ctx, 80, 104, 14, 2, '#e03a3a'); } // 손에 쥔 신청서
  if (frame === 2) for (let i = 0; i < 6; i++) rect(ctx, 76 + i * 4, 100 + i * 3, 3, 1, 'rgba(255,255,255,0.75)'); // 스윙 궤적
  for (let i = 0; i < 12; i++) { const on = Math.floor(u * 7 + i) % 4 === 0; if (on) rect(ctx, 14 + ((i * 29) % 92), 30 + ((i * 17) % 70), 2, 2, i % 2 ? '#ffd24a' : '#ffffff'); } // 반짝이
}

const DRAWERS = { wall: cutWall, bench: cutBench, night: cutNight, offer: cutOffer, resolve: cutResolve };

/** 시각 t 의 한 프레임 (순수: 같은 t → 같은 그림). 컷 페이드 포함 */
export function drawStoryIntro(ctx, t, tl = TIMELINE) {
  const tt = Math.max(0, Math.min(tl.total, t)); const ci = cutIndexAt(tt, tl); const sp = tl.spans[ci];
  DRAWERS[sp.id](ctx, tt - sp.start);
  const a = cutFade(tt, tl);
  if (a > 0) { ctx.fillStyle = `rgba(7,12,24,${a.toFixed(3)})`; ctx.fillRect(0, 0, INTRO_W, INTRO_H); }
}

/**
 * 진행 제어: tick(dt) 로 시간 전달 / advance() 탭 = 타이핑 중이면 그 줄을 끝까지, 아니면 다음 줄로 / skip() 전부 건너뜀.
 * onDone({skipped}) 은 정확히 1번.
 */
export function createStoryIntro({ timeline = TIMELINE, onDone = () => {} } = {}) {
  let t = 0; let done = false;
  const finish = (skipped) => { if (done) return false; done = true; onDone({ skipped }); return true; };
  const segAt = () => timeline.segs.find((s) => t >= s.start && t < s.end);
  return {
    get t() { return t; }, get done() { return done; },
    tick(dt) { if (done) return true; t += Math.max(0, dt); if (t >= timeline.total) finish(false); return done; },
    advance() {
      if (done) return false;
      const s = segAt();
      if (!s) return finish(false);
      if (t < s.typeEnd) { t = s.typeEnd; return true; } // 타이핑 중: 먼저 끝까지 보여 준다
      const next = timeline.segs.find((x) => x.start >= s.end - 1e-9);
      if (!next) return finish(false);
      t = next.start; return true;
    },
    skip() { return finish(true); },
  };
}
