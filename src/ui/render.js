// 경기 화면 Canvas 렌더러 (도트 스타일: 저해상도 내부 버퍼 → CSS 로 확대, 스무딩 끔)
import {
  SPRITES, PALETTES, SPRITE_W, SPRITE_H, BALL, BALL_PALETTE, drawSprite,
} from './sprites.js?v=1791275435';
import { createEffects } from './effects.js?v=1791275435';

export const VIEW_W = 160;
export const VIEW_H = 300;
const TX = 20; const TW = 120; // 탁구대 x 범위 (코트 x 0..100)
const TY = 60; const SC = 0.8; // 코트 y 1단위 = 0.8px (코트 y -70..270 이 화면에 들어옴: 위아래 대칭 여백)
const TH = Math.round(200 * SC); // 탁구대 길이 (코트 y 0..200). 양쪽 끝선 뒤는 선수가 치는 구역

const sx = (x) => TX + (x / 100) * TW;
const sy = (y) => TY + y * SC;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const C = {
  bg: '#16212e', floor: '#1d2b3b', tableDark: '#14573a', tableA: '#1f7a4d', tableB: '#1c7048', line: '#e8f1e8',
  netA: '#f2f6f8', netB: '#aab6c0', post: '#2a2f36', shadow: 'rgba(0,0,0,0.30)',
  zone: 'rgba(255,220,80,0.30)', zoneEdge: '#ffd24a', perfect: 'rgba(255,120,60,0.55)', chevron: '#fff',
  top: '#ff5a4a', back: '#4aa3ff',
};

// 프레임 규칙: 타격 직후 0.12초 = 타격 프레임(2), 이어서 0.12초 = 준비 프레임(1), 이후 대기(0)
export function swingFrame(sinceHit) {
  if (sinceHit == null || sinceHit < 0) return 0;
  if (sinceHit < 0.12) return 2;
  if (sinceHit < 0.24) return 1;
  return 0;
}

export function createRenderer(canvas, { rng, options } = {}) {
  // 설정(이펙트/흔들림/가이드)은 프레임마다 읽는다 → 토글 즉시 반영
  const opt = () => ({ effects: true, shake: true, guide: true, ...(options?.() ?? {}) });
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  const trail = [];
  const fx = createEffects(rng);
  const st = {
    swing: { me: null, opp: null }, meX: 50, oppX: 50, lastNow: null, lastGrade: 'GOOD', look: 'opp', shake: 0,
  };

  function paintStatic(g) {
    const ctx = g; // 바닥 + 탁구대 + 네트 (매 프레임 동일)
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = C.floor;
    for (let y = 0; y < VIEW_H; y += 8) ctx.fillRect(0, y, VIEW_W, 1); // 바닥 줄무늬
    ctx.fillStyle = C.shadow; ctx.fillRect(TX + 4, TY + 4, TW, TH); // 그림자
    ctx.fillStyle = C.tableDark; ctx.fillRect(TX - 2, TY - 2, TW + 4, TH + 4); // 테두리
    ctx.fillStyle = C.tableA; ctx.fillRect(TX, TY, TW, TH);
    ctx.fillStyle = C.tableB; // 체커 질감
    for (let y = 0; y < TH; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < TW; x += 8) ctx.fillRect(TX + x, TY + y, 4, 2);
    ctx.fillStyle = C.line;
    ctx.fillRect(TX, TY, TW, 1); ctx.fillRect(TX, TY + TH - 1, TW, 1);
    ctx.fillRect(TX, TY, 1, TH); ctx.fillRect(TX + TW - 1, TY, 1, TH);
    ctx.fillRect(TX + TW / 2, TY, 1, TH); // 중앙선
    // 네트: 기둥 + 그물
    const ny = Math.round(sy(100));
    ctx.fillStyle = C.post; ctx.fillRect(TX - 5, ny - 4, 3, 8); ctx.fillRect(TX + TW + 2, ny - 4, 3, 8);
    for (let x = 0; x < TW + 4; x += 2) {
      ctx.fillStyle = (x / 2) % 2 ? C.netB : C.netA;
      ctx.fillRect(TX - 2 + x, ny - 2, 2, 4);
    }
    ctx.fillStyle = C.netA; ctx.fillRect(TX - 2, ny - 3, TW + 4, 1); // 네트 상단 테이프
  }

  // 정적 배경은 오프스크린에 한 번만 그리고 프레임마다 drawImage (모바일 비용 절감)
  let layer = null;
  try {
    const off = globalThis.document?.createElement?.('canvas');
    const g = off?.getContext?.('2d');
    if (off && g && typeof ctx?.drawImage === 'function') {
      off.width = VIEW_W; off.height = VIEW_H;
      g.imageSmoothingEnabled = false;
      layer = off;
      paintStatic(g);
    }
  } catch { layer = null; }
  function drawFloorAndTable() {
    if (layer) ctx.drawImage(layer, 0, 0);
    else paintStatic(ctx);
  }

  // 스캔라인 디더: 2행마다 1줄 (1px 점 수천 개 대신 줄 수십 개)
  function dither(x, y, w, h, color) {
    ctx.fillStyle = color;
    for (let j = 0; j < h; j += 2) ctx.fillRect(x, y + j, w, 1);
  }

  function drawZone(timing) {
    if (!timing?.zone) return;
    const { y, half } = timing.zone;
    const top = Math.round(sy(y - half)); const h = Math.max(3, Math.round(2 * half * SC));
    dither(TX, top, TW, h, C.zone);
    ctx.fillStyle = C.zoneEdge; ctx.fillRect(TX, top, TW, 1); ctx.fillRect(TX, top + h - 1, TW, 1); // 경계선
    const ph = (timing.perfectHalf / timing.halfTime) * half;
    const pt = Math.round(sy(y - ph)); const phh = Math.max(2, Math.round(2 * ph * SC));
    ctx.fillStyle = C.perfect; ctx.fillRect(TX, pt, TW, phh);
    ctx.fillStyle = C.chevron; // 중앙 화살표 (>> 모양)
    const cy = Math.round(sy(y));
    for (let i = 0; i < 3; i++) {
      const cx = TX + 14 + i * 46;
      ctx.fillRect(cx, cy - 2, 1, 1); ctx.fillRect(cx + 1, cy - 1, 1, 1); ctx.fillRect(cx + 2, cy, 1, 1);
      ctx.fillRect(cx + 1, cy + 1, 1, 1); ctx.fillRect(cx, cy + 2, 1, 1);
    }
  }

  function drawPlayers(ctl, now) {
    const meFrame = (() => {
      const f = swingFrame(st.swing.me == null ? null : now - st.swing.me);
      if (f) return f;
      return ctl.timing && now - ctl.t0 > ctl.timing.start - 0.12 ? 1 : 0; // 존이 열리기 직전 준비 자세
    })();
    const oppFrame = (() => {
      const f = swingFrame(st.swing.opp == null ? null : now - st.swing.opp);
      if (f) return f;
      return ctl.aiAt != null && now > ctl.aiAt - 0.15 ? 1 : 0;
    })();
    drawSprite(ctx, SPRITES.opp[oppFrame], PALETTES[st.look], Math.round(sx(st.oppX) - SPRITE_W / 2), Math.round(sy(-12)) - SPRITE_H);
    drawSprite(ctx, SPRITES.me[meFrame], PALETTES.me, Math.round(sx(st.meX) - SPRITE_W / 2), Math.round(sy(212)));
  }

  function drawBall(ball, spin = 0) {
    if (!ball?.visible) { trail.length = 0; return; }
    const bx = Math.round(sx(ball.x)); const by = Math.round(sy(ball.y) - (ball.z ?? 0) * 0.8);
    trail.push({ x: bx, y: by });
    if (trail.length > 7) trail.shift();
    if (spin !== 0) {
      ctx.fillStyle = spin > 0 ? C.top : C.back;
      trail.forEach((p, i) => { if (i < trail.length - 1) ctx.fillRect(p.x, p.y, i > 3 ? 2 : 1, i > 3 ? 2 : 1); });
    }
    ctx.fillStyle = C.shadow; ctx.fillRect(bx - 2, Math.round(sy(ball.y)), 5, 2); // 그림자 (바닥 높이)
    drawSprite(ctx, BALL, BALL_PALETTE, bx - 2, by - 2);
  }

  function follow(ctl, dt) {
    // 선수는 공이 향하는 지점으로 부드럽게 이동
    const land = ctl.flight?.land?.x;
    const incomingMe = ctl.timing != null;
    const target = (side) => (land != null && ((side === 'me') === incomingMe) ? clamp(land, 8, 92) : 50);
    const k = Math.min(1, dt * 8);
    st.meX += (target('me') - st.meX) * k;
    st.oppX += (target('opp') - st.oppX) * k;
  }

  return {
    effects: fx,
    state: st,
    setOpponentLook(look) { st.look = look === 'rival' ? 'rival' : 'opp'; },
    /** 컨트롤러 이벤트 수신: 스윙 애니메이션 + 이펙트 */
    notify(e, now) {
      if (e.type === 'grade') st.lastGrade = e.grade;
      if (e.type === 'hit') {
        trail.length = 0; // 새 공: 이전 궤적과 이어지지 않게
        st.swing[e.side] = now;
        const p = e.flight?.pos ? e.flight.pos(0) : { x: 50, y: e.side === 'me' ? 170 : 30 };
        if (opt().effects) fx.hit(sx(p.x), sy(p.y), e.side === 'me' ? st.lastGrade : 'GOOD');
      }
      if (e.type === 'point') {
        if (opt().effects) fx.score(sx(st.meX), sy(e.winner === 'me' ? 190 : 10), e.winner === 'me');
        st.shake = e.winner !== 'me' && opt().effects && opt().shake ? 0.25 : 0;
      }
      if (e.type === 'end' && e.winner === 'me' && opt().effects) fx.cheer(VIEW_W, VIEW_H);
    },
    draw(ctl, now) {
      if (!ctx) return;
      const dt = st.lastNow == null ? 0 : clamp(now - st.lastNow, 0, 0.1);
      st.lastNow = now;
      follow(ctl, dt);
      if (!opt().effects) fx.clear();
      fx.update(dt);
      st.shake = Math.max(0, st.shake - dt);
      ctx.save?.();
      if (st.shake > 0) ctx.translate?.(Math.round((Math.random() - 0.5) * 3), 0); // 실점 시 짧은 흔들림
      drawFloorAndTable();
      if (opt().guide) drawZone(ctl.timing);
      drawPlayers(ctl, now);
      drawBall(ctl.ballAt(now), ctl.flight?.spin ?? 0);
      fx.draw(ctx);
      ctx.restore?.();
    },
    sx, sy,
  };
}
