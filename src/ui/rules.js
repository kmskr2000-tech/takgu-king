// 룰 설명 도트 다이어그램. drawRuleDiagram(ctx, id, t, mode) 는 시간 t(초)만으로 그리는 순수 함수(같은 t → 같은 그림).
// 96x64 격자. 룰 화면 카드와 튜토리얼 코치 패널이 같은 그림을 쓴다.
export const DIAGRAM_W = 96;
export const DIAGRAM_H = 64;

const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
const frac = (t, period) => ((t % period) + period) % period / period;

function line(g, x0, y0, x1, y1, c, size = 1) { // Bresenham
  let x = Math.round(x0); let y = Math.round(y0); const xe = Math.round(x1); const ye = Math.round(y1);
  const dx = Math.abs(xe - x); const dy = -Math.abs(ye - y); const sx = x < xe ? 1 : -1; const sy = y < ye ? 1 : -1; let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    R(g, x, y, size, size, c);
    if (x === xe && y === ye) break;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x += sx; } if (e2 <= dx) { err += dx; y += sy; }
  }
}
function disc(g, cx, cy, r, c) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + 1) R(g, cx + i, cy + j, 1, 1, c); }
function dash(g, x0, y0, x1, y1, c) { // 점선
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i += 3) R(g, lerp(x0, x1, i / n), lerp(y0, y1, i / n), 1, 1, c);
}

const FINGER = [
  '...##...', '...##...', '...##...', '...##.#.', '.#.######', '.########', '.########', '..#######', '..#######', '...######', '....####.',
].map((r) => r.padEnd(9, '.'));
function finger(g, x, y, press) { // 손끝이 (x,y) 를 가리킨다. press 면 살짝 눌린다
  const oy = press ? 2 : 0;
  FINGER.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') { R(g, x - 3 + i + 1, y + j + oy + 1, 1, 1, '#14110f'); } }));
  FINGER.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') R(g, x - 3 + i, y + j + oy, 1, 1, '#f2c9a0'); }));
}
const ripple = (g, x, y, k) => { if (k <= 0 || k >= 1) return; const r = 2 + Math.round(k * 7); for (let a = 0; a < 16; a++) R(g, x + Math.cos((a / 16) * 6.283) * r, y + Math.sin((a / 16) * 6.283) * (r * 0.5), 1, 1, '#ffffff'); };

const BG = '#0d1b2a'; const TABLE = '#1f7a4d'; const TABLE2 = '#1b7048'; const NET = '#dfe6ec'; const BALL = '#fff6d8';
function bg(g) { R(g, 0, 0, DIAGRAM_W, DIAGRAM_H, BG); for (let y = 0; y < DIAGRAM_H; y += 4) R(g, 0, y, DIAGRAM_W, 1, '#102235'); }
function table(g, yTop = 6, yBot = 50, wTop = 40, wBot = 84) { // 원근 탁구대
  for (let y = yTop; y <= yBot; y++) {
    const w = lerp(wTop, wBot, (y - yTop) / (yBot - yTop)); R(g, 48 - w / 2, y, w, 1, Math.floor((y - yTop) / 4) % 2 ? TABLE2 : TABLE);
    R(g, 48 - w / 2, y, 1, 1, '#e8f1e8'); R(g, 48 + w / 2 - 1, y, 1, 1, '#e8f1e8');
  }
  R(g, 48 - wTop / 2, yTop, wTop, 1, '#e8f1e8'); R(g, 48 - wBot / 2, yBot, wBot, 1, '#e8f1e8'); R(g, 48, yTop, 1, yBot - yTop, '#7fb89a');
  const yn = Math.round(lerp(yTop, yBot, 0.42)); const wn = lerp(wTop, wBot, 0.42);
  for (let x = 0; x < wn; x += 2) R(g, 48 - wn / 2 + x, yn - 2, 2, 3, x % 4 ? NET : '#9aa6b2');
}
const tableX = (u, y, yTop = 6, yBot = 50, wTop = 40, wBot = 84) => 48 + (u - 0.5) * lerp(wTop, wBot, (y - yTop) / (yBot - yTop)); // u: 0..1 (테이블 폭 위치)
const ball = (g, x, y, shadow) => { if (shadow != null) R(g, x - 2, shadow, 5, 1, 'rgba(0,0,0,0.4)'); disc(g, Math.round(x), Math.round(y), 2, BALL); R(g, Math.round(x) - 1, Math.round(y) - 1, 1, 1, '#ffffff'); };

// ① 타이밍: 공이 노란 띠(GOOD)에 들어와 붉은 가운데(PERFECT)에 올 때 탭
function timing(g, t) {
  bg(g); table(g);
  const yA = 38; const yB = 47;
  for (let y = yA; y <= yB; y++) { const w = lerp(40, 84, (y - 6) / 44); R(g, 48 - w / 2, y, w, 1, (y + 0) % 2 ? 'rgba(255,220,80,0.45)' : 'rgba(255,220,80,0.2)'); }
  for (let y = 41; y <= 43; y++) { const w = lerp(40, 84, (y - 6) / 44); R(g, 48 - w / 2, y, w, 1, 'rgba(255,90,40,0.7)'); }
  const u = frac(t, 2.6); // 공: 0..0.3 위에서 바운드, 이후 띠를 지나간다
  const y = lerp(10, 54, u);
  const hop = u < 0.25 ? Math.sin((u / 0.25) * Math.PI) * 6 : u < 0.5 ? Math.sin(((u - 0.25) / 0.25) * Math.PI) * 4 : 0;
  ball(g, 48, y - hop, y + 2);
  const press = u > 0.74 && u < 0.84; // 가운데 직전 — 탭
  finger(g, 80, 48, press); ripple(g, 80, 56, press ? (u - 0.74) / 0.1 : 0);
  if (press) R(g, 20, 42, 56, 1, '#ffffff'); // 지금! 신호
}

// ② 코스: 탭하는 위치(왼쪽/가운데/오른쪽) → 공이 가는 방향
function course(g, t) {
  bg(g); table(g);
  const k = Math.floor(t / 1.4) % 3; const lane = [0.17, 0.5, 0.83][k]; const f = frac(t, 1.4);
  for (let i = 0; i < 3; i++) { // 가까운 쪽 3등분 + 선택 강조
    const a = i / 3; const b = (i + 1) / 3;
    for (let y = 40; y <= 50; y++) R(g, tableX(a, y), y, Math.max(1, tableX(b, y) - tableX(a, y)), 1, i === k ? 'rgba(255,210,74,0.5)' : 'rgba(255,255,255,0.08)');
  }
  for (const a of [1 / 3, 2 / 3]) line(g, tableX(a, 40), 40, tableX(a, 50), 50, 'rgba(255,255,255,0.35)');
  finger(g, tableX(lane, 46), 47, f < 0.25); ripple(g, tableX(lane, 46), 54, f < 0.25 ? f / 0.25 : 0);
  const tx = tableX(lane, 14); const sx = tableX(lane, 46);
  dash(g, sx, 44, tx, 14, '#ffd24a'); // 공이 갈 길
  const m = Math.min(1, f / 0.8); if (f > 0.2) ball(g, lerp(sx, tx, m), lerp(44, 14, m) - Math.sin(m * Math.PI) * 5, null);
  disc(g, Math.round(tx), 12, 2, '#ffd24a'); R(g, Math.round(tx) - 4, 11, 9, 1, 'rgba(255,210,74,0.6)');
}

// ③ 샷 종류: 탑스핀(빠르고 낮게, 붉은 궤적) vs 커트(느리고 높게, 푸른 궤적)
function shots(g, t) {
  bg(g);
  R(g, 4, 52, 88, 2, TABLE); R(g, 47, 38, 2, 14, NET); R(g, 4, 54, 88, 1, '#14573a');
  const arc = (x0, x1, apex, k, c, trail, fade) => { // 전체 경로는 옅게 미리 보여 주고, 지나간 부분은 진하게 + 공
    for (let i = 0; i <= 28; i++) { const u = i / 28; const x = lerp(x0, x1, u); const y = 52 - 3 - 4 * apex * u * (1 - u); R(g, x, y, 1, 1, fade); }
    for (let i = 0; i <= 28; i++) { const u = i / 28; if (u > k) break; const x = lerp(x0, x1, u); const y = 52 - 3 - 4 * apex * u * (1 - u); if (u > k - 0.3) R(g, x, y, 2, 2, c); }
    const x = lerp(x0, x1, k); const y = 52 - 3 - 4 * apex * k * (1 - k); ball(g, x, y, null); if (trail) R(g, x - 4, y, 3, 1, c);
  };
  arc(6, 90, 16, Math.min(1, frac(t, 2.2) * 1.45), '#ff5a4a', true, 'rgba(255,90,74,0.45)'); // 탑스핀: 낮고 빠름 (더 일찍 도착)
  arc(6, 90, 44, Math.min(1, frac(t, 2.2) * 0.95), '#4aa3ff', true, 'rgba(74,163,255,0.45)'); // 커트: 높고 느림
  R(g, 4, 6, 3, 3, '#ff5a4a'); R(g, 4, 14, 3, 3, '#4aa3ff');
}

// ④ 파워/샷 선택: 간단=샷 버튼 3개와 궤적, 고급=쓰는 길이와 위험 구간
function power(g, t, mode) {
  bg(g);
  if (mode === 'advanced') {
    const x0 = 14; const w = 68; // 파워 막대: 짧음(네트 위험) | 적당 | 너무 김(아웃 위험)
    R(g, x0, 30, w * 0.28, 8, '#4aa3ff'); R(g, x0 + w * 0.28, 30, w * 0.44, 8, '#6fcf6f'); R(g, x0 + w * 0.72, 30, w * 0.28, 8, '#ff5a4a');
    R(g, x0 - 1, 29, w + 2, 1, '#fff'); R(g, x0 - 1, 38, w + 2, 1, '#fff');
    const p = (Math.sin(t * 1.6) + 1) / 2; const px = x0 + p * w; // 현재 쓴 길이
    R(g, px - 1, 24, 3, 20, '#ffd24a'); finger(g, Math.round(px), 44, true);
    R(g, x0, 18, 20, 2, '#4aa3ff'); R(g, x0 + w - 20, 18, 20, 2, '#ff5a4a'); R(g, x0 + 24, 18, 20, 2, '#6fcf6f');
  } else {
    const sel = Math.floor(t / 1.2) % 3; const cols = ['#f4f4f4', '#ff5a4a', '#4aa3ff'];
    for (let i = 0; i < 3; i++) { // 샷 선택 버튼 3개
      const x = 6 + i * 30; R(g, x, 40, 28, 18, i === sel ? cols[i] : '#16212e'); R(g, x, 40, 28, 1, cols[i]); R(g, x, 57, 28, 1, cols[i]); R(g, x, 40, 1, 18, cols[i]); R(g, x + 27, 40, 1, 18, cols[i]);
      R(g, x + 9, 46, 10, 2, i === sel ? '#111' : cols[i]); R(g, x + 12, 50, 4, 2, i === sel ? '#111' : cols[i]);
    }
    const apex = [26, 14, 34][sel]; const k = Math.min(1, frac(t, 1.2) * (sel === 1 ? 1.4 : sel === 2 ? 0.9 : 1.1));
    R(g, 4, 30, 88, 2, TABLE); R(g, 47, 20, 2, 10, NET);
    for (let i = 0; i <= 20; i++) { const u = i / 20; if (u > k) break; if (i % 2 === 0) R(g, lerp(6, 90, u), 28 - 4 * apex * u * (1 - u) * 0.8, 1, 1, cols[sel]); }
    ball(g, lerp(6, 90, k), 28 - 4 * apex * k * (1 - k) * 0.8, null);
  }
}

// ⑤ 점수·서브: 11점제, 2점마다 서브 교대, 10:10 이후 2점 차
function score(g, t) {
  bg(g);
  const step = Math.floor(t / 1.1) % 6; const me = [0, 1, 2, 3, 4, 5][step]; const opp = [0, 0, 1, 2, 2, 3][step];
  R(g, 22, 8, 52, 24, '#0a0d14'); R(g, 22, 8, 52, 1, '#39406e'); R(g, 22, 31, 52, 1, '#39406e'); R(g, 22, 8, 1, 24, '#39406e'); R(g, 73, 8, 1, 24, '#39406e');
  const D = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111' };
  const dig = (n, x, c) => [...D[n]].forEach((b, i) => { if (b === '1') R(g, x + (i % 3) * 3, 12 + Math.floor(i / 3) * 3, 3, 3, c); });
  dig(opp, 28, '#e8e8f0'); R(g, 47, 16, 2, 2, '#8d98a5'); R(g, 47, 22, 2, 2, '#8d98a5'); dig(me, 54, '#ffd24a');
  const serverMe = Math.floor((me + opp) / 2) % 2 === 0; // 2점마다 교대
  disc(g, serverMe ? 62 : 33, 38, 2, BALL); R(g, serverMe ? 54 : 25, 42, 16, 2, serverMe ? '#ffd24a' : '#e8e8f0');
  R(g, 40, 48, 16, 2, '#39406e'); for (let i = 0; i < 11; i++) R(g, 8 + i * 8, 56, 5, 3, i < me ? '#ffd24a' : '#26324a'); // 11점 눈금
}

// ⑥ 성장: 승리 3pt/패배 1pt → 스탯 투자, 우승하면 승격과 장비 해금
function growth(g, t) {
  bg(g);
  const k = Math.floor(t / 1.3) % 3; const icons = [['#ff5a4a', 'P'], ['#4aa3ff', 'S'], ['#ffd24a', 'F']];
  icons.forEach(([c], i) => {
    const x = 10 + i * 30; R(g, x, 26, 24, 24, '#16212e'); R(g, x, 26, 24, 1, c); R(g, x, 49, 24, 1, c); R(g, x, 26, 1, 24, c); R(g, x + 23, 26, 1, 24, c);
    const h = 6 + (i === k ? 4 : 0) + i * 2; R(g, x + 6, 46 - h, 12, h, c);
    if (i === k) { const f = frac(t, 1.3); R(g, x + 10, 14 - Math.round(f * 4), 3, 9, '#fff'); R(g, x + 7, 17 - Math.round(f * 4), 9, 3, '#fff'); }
  });
  R(g, 10, 56, 24, 3, '#6fcf6f'); R(g, 38, 56, 12, 3, '#ffd24a'); // 승리 3pt / 패배 1pt
  R(g, 76, 8, 12, 10, '#ffd24a'); R(g, 79, 18, 6, 4, '#ffd24a'); R(g, 77, 22, 10, 2, '#a8743a'); R(g, 74, 10, 2, 5, '#ffd24a'); R(g, 88, 10, 2, 5, '#ffd24a'); // 트로피
}

const DRAWERS = { timing, course, shots, power, score, growth };
export const DIAGRAM_IDS = Object.freeze(Object.keys(DRAWERS));

export function drawRuleDiagram(g, id, t = 0, mode = 'simple') {
  const fn = DRAWERS[id];
  if (!fn) throw new Error(`알 수 없는 다이어그램: ${id}`);
  fn(g, t, mode);
}

/** 룰 카드(제목·설명·칩). 조작 방식에 따라 샷/파워 카드 문구가 달라진다 */
export function ruleCards(mode = 'simple') {
  const simple = mode !== 'advanced';
  return [
    { id: 'timing', title: simple ? '① 타이밍: 띠에서 버튼!' : '① 타이밍: 띠에서 탭!', text: simple ? '공이 튕기면 노란 띠가 나타나요. 공이 띠 안에 있을 때 샷 버튼을 누르세요. 누르는 샷 색 띠(빨강 탑스핀·노랑 일반·파랑 커트)의 한가운데 밝은 줄이 PERFECT예요.' : '공이 튕기면 노란 띠가 나타나요. 공이 띠 안에 있을 때 화면을 탭하세요. 가운데 붉은 띠가 PERFECT, 띠 가장자리는 아슬아슬(BAD): 쳐지긴 해도 약하고 실수가 잘 나요.', chips: [['PERFECT', '한가운데', '#ff8a5a'], ['GOOD', '양옆', '#ffd24a'], ['BAD', '가장자리', '#9aa4ae'], ['MISS', '띠 밖 / 안 누름', '#8d98a5']] },
    { id: 'course', title: simple ? '② 코스: 코트를 탭' : '② 코스: 탭하는 위치', text: simple ? '코트의 왼쪽을 탭해 두면 왼쪽으로, 가운데는 가운데로, 오른쪽은 오른쪽으로 공이 가요. 탭은 코스만 정하고, 샷 버튼을 누를 때 그 코스로 나가요. 상대가 없는 쪽을 노려요.' : '화면 왼쪽을 탭하면 왼쪽으로, 가운데는 가운데로, 오른쪽은 오른쪽으로 공이 가요. 상대가 없는 쪽을 노려요.', chips: [['왼쪽', '↖', '#ffd24a'], ['가운데', '↑', '#ffd24a'], ['오른쪽', '↗', '#ffd24a']] },
    { id: 'shots', title: '③ 탑스핀 vs 커트', text: '탑스핀은 빠르고 낮게(붉은 궤적) 상대를 압박하고, 커트는 느리고 높게(푸른 궤적) 떠서 상대의 강타를 막아요.', chips: [['탑스핀', '빠르고 낮게', '#ff5a4a'], ['커트', '느리고 높게', '#4aa3ff']] },
    simple
      ? { id: 'power', title: '④ 샷 고르기와 상성', text: '샷 버튼을 누르는 순간이 스윙! 날아오는 공 종류(빨강 탑스핀·흰색 일반·파랑 커트)를 보고 바로 눌러요. 코스는 코트를 탭해서 정해요. 상성: 탑스핀은 커트에, 커트는 일반에, 일반은 탑스핀에 강해요. 상성이 맞으면 샷이 안정되고 상대가 흔들려요(카운터!). 반대면 실수가 늘고 밀려요. 단, 상성보다 타이밍이 더 중요해요 — 퍼펙트면 불리해도 안전! 띠는 샷마다 달라요: 탑스핀(빨강)은 빠르게, 커트(파랑)는 느리게 눌러요.', chips: [['탑스핀 > 커트', '느린 공 공격', '#ff5a4a'], ['커트 > 일반', '깔아 치기', '#4aa3ff'], ['일반 > 탑스핀', '힘 되돌리기', '#f4f4f4']] }
      : { id: 'power', title: '④ 파워: 쓰는 길이', text: '탭하면서 위로 쓸면 탑스핀, 아래로 쓸면 커트. 쓰는 길이가 길수록 강한 샷이지만 너무 길면 네트·아웃 위험이 커져요.', chips: [['짧게', '네트 주의', '#4aa3ff'], ['적당히', '안전', '#6fcf6f'], ['너무 길게', '아웃 주의', '#ff5a4a']] },
    { id: 'score', title: '⑤ 점수: 11점 + 서브 교대', text: '먼저 11점을 따면 승리! 서브는 2점마다 바뀌어요. 10:10이 되면 2점 차로 이길 때까지 계속하고, 그때는 한 점마다 서브가 바뀌어요.', chips: [['11점', '선취', '#ffd24a'], ['2점마다', '서브 교대', '#e8e8f0'], ['10:10', '2점 차', '#ff8a5a']] },
    { id: 'growth', title: '⑥ 성장: 포인트와 장비', text: '승리하면 3pt, 패배해도 1pt를 받아요. 파워·스핀·집중에 투자하세요. 리그에서 우승하면 승격하고 새 그립·라켓이 열려요.', chips: [['승리', '+3pt', '#6fcf6f'], ['패배', '+1pt', '#ffd24a'], ['우승', '승격 + 장비', '#ff8a5a']] },
  ];
}

/** 튜토리얼 단계 → 코치 패널에 보여줄 설명 그림 (없으면 null) */
export const DIAGRAM_FOR_STEP = Object.freeze({ timing: 'timing', perfect: 'timing', course: 'course', topspin: 'shots', cut: 'shots', power: 'power' });
