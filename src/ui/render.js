// 경기 화면 Canvas 렌더러 v2: 내 선수 뒤에서 보는 원근(pseudo-3D) 시점. 도트 스타일(저해상도 버퍼 → CSS 확대).
// 물리·판정은 코트 좌표(x 0..100, y 0..200, 네트 y=100, 내 쪽이 y 큼)를 그대로 쓰고, 여기서는 화면 투영만 바꾼다.
import {
  SPRITES, PALETTES, SPRITE_W, SPRITE_H, BALL, BALL_PALETTE, drawSprite,
} from './sprites.js?v=1791278878';
import { createEffects } from './effects.js?v=1791278878';
import { createRng } from '../core/rng.js?v=1791278878';

export const VIEW_W = 160;
export const VIEW_H = 320;

// ---- 카메라: 내 쪽 끝선(y=200) 뒤 쪽에서 코트를 내려다본다 ----
export const CAM = Object.freeze({
  CX: 80, // 화면 중앙 x
  D: 250, // 기준선(y=YN)에서 카메라까지 거리
  YN: 270, // 기준선 (내 쪽 타격 구역 끝)
  KX: 480, // 가로 배율: 1코트단위 = KX/d 픽셀
  KY: 95680, // 세로(지면) 배율
  HOR: -64, // 소실점 화면 y
  ZK: 0.8, // 높이(z) 배율
  Y_NEAR: 268, // 이보다 가까우면 컬링 (투영 폭주 방지)
  Y_FAR: -70,
});
const depth = (y) => CAM.D + CAM.YN - y;

/** 코트 좌표 → 화면. 카메라 뒤/너무 가까운 점은 null. k = 그 깊이의 픽셀/단위 배율 */
export function project(x, y, z = 0) {
  if (!(y <= CAM.Y_NEAR) || y < CAM.Y_FAR || !Number.isFinite(x + y + z)) return null;
  const d = depth(y);
  const k = CAM.KX / d;
  return { x: CAM.CX + (x - 50) * k, y: CAM.HOR + CAM.KY / d - z * k * CAM.ZK, k };
}
const groundY = (y) => CAM.HOR + CAM.KY / depth(y);
const halfWidthAtRow = (row) => (50 * CAM.KX) / (CAM.KY / (row - CAM.HOR)); // 화면 행 → 탁구대 폭의 절반
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const C = {
  tableA: '#1f7a4d', tableB: '#1b7048', tableSide: '#0d4f33', tableDark: '#14573a', line: '#e8f1e8',
  netA: '#f2f6f8', netB: '#aab6c0', post: '#2a2f36', shadow: 'rgba(0,0,0,0.32)',
  zone: 'rgba(255,220,80,0.30)', zoneEdge: '#ffd24a', perfect: 'rgba(255,120,60,0.55)', chevron: '#ffffff',
  top: '#ff5a4a', back: '#4aa3ff', floor: '#141d2a', floorLine: '#1d2a3d', wall: '#0b0f1c',
};
const WALL_Y = 112; // 뒷벽(관중석)과 바닥의 경계 (화면 y)
const SKY = ['#05070d', '#070b16', '#0a1022', '#0e1530', '#131a3a', '#1a2350'];
const SHIRTS = ['#d94f4f', '#e8b83a', '#4a9de0', '#6fcf6f', '#c06be0', '#f0f0f0', '#ff8a3d'];

// 프레임 규칙: 타격 직후 0.12초 = 타격 프레임(2), 이어서 0.12초 = 준비 프레임(1), 이후 대기(0)
export function swingFrame(sinceHit) {
  if (sinceHit == null || sinceHit < 0) return 0;
  if (sinceHit < 0.12) return 2;
  if (sinceHit < 0.24) return 1;
  return 0;
}

/** 깊이에 따른 정수 도트 배율 (선수/공 스프라이트) */
export const spriteScale = (k, mult = 2) => Math.max(1, Math.round(k * mult));

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

  const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

  // ---- 정적 배경: 경기장 벽(하늘·조명·관중) + 바닥 + 탁구대 + 네트 ----
  function paintStatic(g) {
    const r = createRng(11);
    // 벽/하늘
    const bandH = Math.ceil(WALL_Y / SKY.length);
    SKY.forEach((c, i) => R(g, 0, i * bandH, VIEW_W, bandH, c));
    for (let i = 0; i < 18; i++) R(g, Math.floor(r.next() * VIEW_W), Math.floor(r.next() * 36), 1, 1, i % 3 ? '#39406e' : '#8b95c9');
    for (const cx of [26, 80, 134]) { // 스포트라이트
      R(g, cx - 3, 0, 6, 3, '#3a3f66'); R(g, cx - 1, 3, 2, 1, '#ffe9a8');
      for (let y = 4; y < WALL_Y; y++) { const half = 2 + Math.floor(y * 0.34); R(g, cx - half, y, half * 2, 1, y % 2 ? 'rgba(255,233,168,0.10)' : 'rgba(255,233,168,0.05)'); }
    }
    // 관중 (뒤 → 앞: 점점 크고 밝게)
    R(g, 0, 62, VIEW_W, WALL_Y - 62, C.wall);
    [{ y: 66, step: 8, head: 3, body: 4, a: 0.55 }, { y: 80, step: 10, head: 4, body: 5, a: 0.75 }, { y: 95, step: 13, head: 5, body: 6, a: 1 }].forEach((row, ri) => {
      for (let x = (ri * 3) % row.step - 2; x < VIEW_W + row.step; x += row.step) {
        const px = x + Math.floor(r.signed() * 1.5);
        const sh = SHIRTS[Math.floor(r.next() * SHIRTS.length)];
        R(g, px - 1, row.y + row.head, row.body + 2, row.body, sh);
        R(g, px, row.y, row.head, row.head, '#e0a97a'); R(g, px, row.y, row.head, Math.max(1, row.head >> 1), '#3a2a1a');
        R(g, px - 1, row.y + row.head, row.body + 2, row.body, `rgba(5,8,16,${(1 - row.a).toFixed(2)})`); // 먼 줄은 어둡게
      }
      R(g, 0, row.y + row.head + row.body, VIEW_W, 2, '#141a2c');
    });
    // 바닥 + 원근선
    R(g, 0, WALL_Y, VIEW_W, VIEW_H - WALL_Y, C.floor);
    R(g, 0, WALL_Y, VIEW_W, 1, '#2a3a52');
    for (let i = -9; i <= 9; i++) {
      const xb = CAM.CX + i * 34;
      for (let row = WALL_Y + 2; row < VIEW_H; row += 2) {
        R(g, Math.round(CAM.CX + ((xb - CAM.CX) * (row - CAM.HOR)) / (VIEW_H - CAM.HOR)), row, 1, 1, C.floorLine);
      }
    }
    // 탁구대 (사다리꼴: 화면 행마다 폭 계산)
    const top = Math.round(groundY(0)); const bot = Math.round(groundY(200));
    R(g, 0, bot + 1, VIEW_W, 0, C.shadow);
    for (let row = top; row <= bot; row++) { // 그림자
      const hw = halfWidthAtRow(row); R(g, Math.round(CAM.CX - hw + 4), row + 3, Math.round(hw * 2), 1, 'rgba(0,0,0,0.28)');
    }
    for (let row = top; row <= bot; row++) {
      const hw = halfWidthAtRow(row); const x0 = Math.round(CAM.CX - hw); const w = Math.round(hw * 2);
      R(g, x0, row, w, 1, Math.floor((row - top) / 6) % 2 ? C.tableB : C.tableA); // 가로 줄무늬 질감
      R(g, x0, row, 1, 1, C.line); R(g, x0 + w - 1, row, 1, 1, C.line); // 좌우 흰 테두리
    }
    const hwTop = Math.round(halfWidthAtRow(top)); const hwBot = Math.round(halfWidthAtRow(bot));
    R(g, CAM.CX - hwTop, top, hwTop * 2, 1, C.line); R(g, CAM.CX - hwBot, bot, hwBot * 2, 1, C.line); // 끝선
    R(g, CAM.CX, top, 1, bot - top, '#7fb89a'); // 중앙선
    // 가까운 쪽 옆면(두께)과 다리
    R(g, CAM.CX - hwBot, bot + 1, hwBot * 2, 6, C.tableSide); R(g, CAM.CX - hwBot, bot + 7, hwBot * 2, 1, '#0a3a26');
    R(g, CAM.CX - hwBot + 6, bot + 8, 6, 22, '#0a0e16'); R(g, CAM.CX + hwBot - 12, bot + 8, 6, 22, '#0a0e16');
    // 네트
    const dN = depth(100); const kN = CAM.KX / dN; const nBase = Math.round(groundY(100)); const nTop = Math.round(nBase - 20 * kN * CAM.ZK);
    const hwN = Math.round(50 * kN);
    R(g, CAM.CX - hwN - 3, nTop - 3, 3, nBase - nTop + 6, C.post); R(g, CAM.CX + hwN, nTop - 3, 3, nBase - nTop + 6, C.post); // 기둥
    for (let row = nTop; row <= nBase; row++) for (let x = CAM.CX - hwN; x < CAM.CX + hwN; x++) {
      if ((x + row) % 2 === 0) R(g, x, row, 1, 1, (Math.floor(x / 3) + row) % 2 ? C.netA : C.netB);
    }
    R(g, CAM.CX - hwN, nTop, hwN * 2, 2, C.netA); // 상단 테이프
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
  function drawStatic() { if (layer) ctx.drawImage(layer, 0, 0); else paintStatic(ctx); }

  // 스캔라인 디더(원근 띠): 행마다 폭이 다르다
  function band(yA, yB, color, step = 2) {
    const r0 = Math.round(groundY(Math.min(yA, yB))); const r1 = Math.round(groundY(Math.min(CAM.Y_NEAR, Math.max(yA, yB))));
    ctx.fillStyle = color;
    for (let row = Math.max(0, r0); row <= Math.min(VIEW_H - 1, r1); row += step) {
      const hw = halfWidthAtRow(row); ctx.fillRect(Math.round(CAM.CX - hw), row, Math.round(hw * 2), 1);
    }
    return [r0, r1];
  }

  function drawZone(timing, now, t0) {
    if (!timing?.zone) return;
    const z = timing.zone;
    // 실제로 탭을 받아주는 범위(난이도 완화 포함)를 그린다. 구버전 데이터는 ±half 로 대체
    const yA = z.yStart ?? z.y - z.half; const yB = z.yEnd ?? z.y + z.half;
    const [r0, r1] = band(yA, yB, C.zone);
    ctx.fillStyle = C.zoneEdge;
    for (const row of [r0, r1]) { const hw = halfWidthAtRow(row); ctx.fillRect(Math.round(CAM.CX - hw), row, Math.round(hw * 2), 1); }
    if (z.yPerfectStart != null) band(z.yPerfectStart, z.yPerfectEnd, C.perfect, 1);
    else { const ph = (timing.perfectHalf / timing.halfTime) * z.half; band(z.y - ph, z.y + ph, C.perfect, 1); }
    const cy = Math.round(groundY(Math.min(z.y, CAM.Y_NEAR)));
    ctx.fillStyle = C.chevron; // 중앙 화살표 (>>)
    for (let i = 0; i < 3; i++) {
      const cx = CAM.CX - 40 + i * 40;
      ctx.fillRect(cx, cy - 3, 2, 2); ctx.fillRect(cx + 2, cy - 1, 2, 2); ctx.fillRect(cx + 4, cy + 1, 2, 2);
      ctx.fillRect(cx + 2, cy + 3, 2, 2); ctx.fillRect(cx, cy + 5, 2, 2);
    }
    // 타이밍 신호: 중심 시각 직전/직후 0.14초 동안 중앙선이 반짝이고 양끝에 표시가 켜진다 ("지금!")
    if (timing.center != null && t0 != null) {
      const rem = timing.center - (now - t0);
      if (Math.abs(rem) < 0.14) {
        const hw = Math.round(halfWidthAtRow(cy));
        ctx.fillStyle = Math.floor(now * 20) % 2 ? '#ffffff' : '#ffd24a';
        ctx.fillRect(CAM.CX - hw - 3, cy, hw * 2 + 6, 3);
        ctx.fillRect(CAM.CX - hw - 7, cy - 5, 5, 13); ctx.fillRect(CAM.CX + hw + 2, cy - 5, 5, 13);
      }
    }
  }

  function drawPlayers(ctl, now) {
    const meFrame = (() => {
      const f = swingFrame(st.swing.me == null ? null : now - st.swing.me);
      if (f) return f;
      if (ctl.phase === 'awaitServe' && ctl.match?.server === 'me') return 1; // 서브 준비 자세(공을 든)
      return ctl.timing && now - ctl.t0 > ctl.timing.start - 0.12 ? 1 : 0; // 존이 열리기 직전 준비 자세
    })();
    const oppFrame = (() => {
      const f = swingFrame(st.swing.opp == null ? null : now - st.swing.opp);
      if (f) return f;
      if (ctl.phase === 'oppServeWait' && ctl.match?.server === 'opp') return 1;
      return ctl.aiAt != null && now > ctl.aiAt - 0.15 ? 1 : 0;
    })();
    const po = project(st.oppX, -12); const pm = project(st.meX, 250);
    const so = spriteScale(po.k); const sm = spriteScale(pm.k); // 상대 2배, 나 4배 도트
    drawSprite(ctx, SPRITES.opp[oppFrame], PALETTES[st.look], Math.round(po.x - (SPRITE_W * so) / 2), Math.round(po.y - SPRITE_H * so), { scale: so });
    R(ctx, Math.round(pm.x - (SPRITE_W * sm) / 2), Math.round(pm.y - 2), SPRITE_W * sm, 3, C.shadow); // 발 그림자
    drawSprite(ctx, SPRITES.me[meFrame], PALETTES.me, Math.round(pm.x - (SPRITE_W * sm) / 2), Math.round(pm.y - SPRITE_H * sm), { scale: sm });
  }

  // 서브 차례 표시: 서버 발밑에 펄스 링 + 머리 위 ▼ + 공을 든 준비 자세 (서브 대기 구간에만)
  const isServePhase = (ctl) => ctl.phase === 'awaitServe' || ctl.phase === 'oppServeWait';
  function drawServeCue(ctl, now) {
    if (!isServePhase(ctl) || !ctl.match) return;
    const side = ctl.match.server;
    const pos = side === 'me' ? project(st.meX, 250) : project(st.oppX, -12);
    const sc = spriteScale(pos.k);
    const pulse = 0.5 + 0.5 * Math.sin(now * 6);
    const rx = Math.round(SPRITE_W * sc * 0.75 + pulse * 3); const ry = Math.max(2, Math.round(rx * 0.27));
    ctx.fillStyle = `rgba(255,210,74,${(0.45 + 0.4 * pulse).toFixed(2)})`;
    for (let i = 0; i < 28; i++) { // 발밑 타원 링
      const a = (i / 28) * Math.PI * 2;
      ctx.fillRect(Math.round(pos.x + Math.cos(a) * rx), Math.round(pos.y + Math.sin(a) * ry), 2, 2);
    }
    const bob = Math.round(Math.sin(now * 5) * 2); // 머리 위 ▼ (까딱까딱)
    const ay = Math.round(pos.y - SPRITE_H * sc - 12 + bob);
    for (let j = 0; j < 4; j++) { // 테두리 + 노랑 삼각형
      ctx.fillStyle = '#14110f'; ctx.fillRect(Math.round(pos.x) - 4 + j, ay + j * 2 - 1, 9 - 2 * j, 3);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(Math.round(pos.x) - 3 + j, ay + j * 2, 7 - 2 * j, 2);
    }
    // 라켓 든 손 위로 공을 들고 있다 (공은 서브하는 순간 비행으로 이어진다)
    const hx = Math.round(pos.x - (SPRITE_W * sc) / 2 + 10.5 * sc); const hy = Math.round(pos.y - SPRITE_H * sc + 6 * sc - 4 * sc + bob);
    const bs = Math.max(1, Math.round(sc / 2));
    drawSprite(ctx, BALL, BALL_PALETTE, hx - Math.floor((5 * bs) / 2), hy - 5 * bs, { scale: bs });
  }

  function drawBall(ball, spin = 0) {
    const p = ball?.visible ? project(ball.x, ball.y, ball.z ?? 0) : null;
    if (!p) { trail.length = 0; return; } // 화면 밖(컬링)이면 그리지 않음
    const g0 = project(ball.x, ball.y, 0);
    const sc = spriteScale(p.k, 0.95);
    const bx = Math.round(p.x); const by = Math.round(p.y);
    trail.push({ x: bx, y: by, s: sc });
    if (trail.length > 7) trail.shift();
    if (spin !== 0) {
      ctx.fillStyle = spin > 0 ? C.top : C.back;
      trail.forEach((q, i) => { if (i < trail.length - 1) { const w = i > 3 ? q.s + 1 : q.s; ctx.fillRect(q.x, q.y, w, w); } });
    }
    R(ctx, bx - 2 * sc, Math.round(g0.y), 5 * sc, Math.max(1, sc), C.shadow); // 지면 그림자
    drawSprite(ctx, BALL, BALL_PALETTE, bx - Math.floor((5 * sc) / 2), by - Math.floor((5 * sc) / 2), { scale: sc });
  }

  function follow(ctl, dt) {
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
    project,
    setOpponentLook(look) { st.look = look === 'rival' ? 'rival' : 'opp'; },
    /** 컨트롤러 이벤트 수신: 스윙 애니메이션 + 이펙트 */
    notify(e, now) {
      if (e.type === 'grade') st.lastGrade = e.grade;
      if (e.type === 'hit') {
        trail.length = 0; // 새 공: 이전 궤적과 이어지지 않게
        st.swing[e.side] = now;
        const c0 = e.flight?.pos ? e.flight.pos(0) : { x: 50, y: e.side === 'me' ? 200 : 0, z: 12 };
        const p = project(c0.x, c0.y, c0.z ?? 0);
        if (p && opt().effects) fx.hit(p.x, p.y, e.side === 'me' ? st.lastGrade : 'GOOD', { scale: spriteScale(p.k, 1) }); // 깊이에 맞춰 스파크 크기
      }
      if (e.type === 'point') {
        const p = project(st.meX, e.winner === 'me' ? 215 : 5);
        if (p && opt().effects) fx.score(p.x, p.y, e.winner === 'me');
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
      drawStatic();
      if (opt().guide) drawZone(ctl.timing, now, ctl.t0);
      drawPlayers(ctl, now);
      drawServeCue(ctl, now);
      drawBall(ctl.ballAt(now), ctl.flight?.spin ?? 0); // 공은 선수 뒤에 가려지지 않게 선수 다음에 그린다
      fx.draw(ctx);
      ctx.restore?.();
    },
  };
}
