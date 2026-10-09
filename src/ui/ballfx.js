// 공 구질 표시(색과 무관한 단서). 순수 함수: 그릴 사각형 목록만 계산하고 canvas 는 render.js 가 그린다.
// 입력은 drawBall 이 받는 spin 하나뿐이다. 구질 위장 구간·멀티의 상대 공은 spin 을 0 으로 넘기므로 단서도 자동으로 사라진다(위장 규칙 유지).
//  - 탑스핀: 길고 이어진 직선 꼬리(혜성) + 공 안에서 빠르게 도는 두 점 + 바운드 때 앞으로 뻗는 속도선
//  - 커트  : 끊어진 점선 꼬리 + 공 안에서 반대로 천천히 도는 한 점 + 바운드 때 납작하게 깔리는 선
//  - 일반  : 꼬리·회전 없음

export const SPIN_CLASS_AT = 0.5; // controls.js shotKeyOfSpin 과 같은 경계

export const spinKind = (spin = 0) => (spin > SPIN_CLASS_AT ? 'top' : spin < -SPIN_CLASS_AT ? 'cut' : 'normal');

// 5×5 공 스프라이트의 안쪽 3×3 테두리 8칸(시계 방향)
const RING = [[1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [1, 2]];
const mod = (n, m) => ((n % m) + m) % m;

/** 공 안의 회전 표시. 반환: [{ x, y, w, h }] (공 왼쪽 위 기준 도트 → 화면 좌표, sc = 도트 배율) */
export function stripeRects(spin, t, bx, by, sc) {
  const kind = spinKind(spin);
  if (kind === 'normal') return [];
  const ox = bx - Math.floor((5 * sc) / 2); const oy = by - Math.floor((5 * sc) / 2);
  const cell = (i) => ({ x: ox + RING[mod(i, 8)][0] * sc, y: oy + RING[mod(i, 8)][1] * sc, w: sc, h: sc });
  if (kind === 'top') { const i = Math.floor(t * 18); return [cell(i), cell(i + 4)]; } // 빠르게, 마주 보는 두 점
  return [cell(-Math.floor(t * 4))]; // 천천히, 반대 방향, 한 점
}

/** 꼬리. trail: 오래된 → 최신 [{x,y,s}] (마지막이 지금 공 위치). 반환: [{ x, y, w, h }] */
export function tailRects(spin, trail) {
  const kind = spinKind(spin);
  if (kind === 'normal' || trail.length < 2) return [];
  const out = [];
  const n = trail.length;
  if (kind === 'top') { // 이어진 직선: 점 사이를 메우고 끝으로 갈수록 가늘다
    for (let i = 0; i < n - 1; i++) {
      const a = trail[i]; const b = trail[i + 1];
      const w = Math.max(1, Math.round(a.s * (0.35 + 0.65 * (i / n))));
      const steps = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / Math.max(1, w)));
      for (let k = 0; k < steps; k++) {
        const u = k / steps;
        out.push({ x: Math.round(a.x + (b.x - a.x) * u), y: Math.round(a.y + (b.y - a.y) * u), w, h: w });
      }
    }
    return out;
  }
  for (let i = 0; i < n - 1; i += 2) { // 커트: 한 점 건너 한 점, 작은 점
    const q = trail[i]; const w = Math.max(1, q.s - 1);
    out.push({ x: q.x, y: q.y, w, h: w });
  }
  return out;
}

export const BOUNCE_FX_S = 0.16; // 바운드 연출 지속(초)
/** 바운드 순간 연출. age: 바운드 후 경과(초). 반환: [{ x, y, w, h }] (x,y = 바운드 지점 화면 좌표, dir = 공이 가는 화면 방향) */
export function bounceRects(spin, age, x, y, sc, dir = 1) {
  const kind = spinKind(spin);
  if (kind === 'normal' || age < 0 || age > BOUNCE_FX_S) return [];
  const f = age / BOUNCE_FX_S;
  if (kind === 'top') { // 공이 가는 쪽(dir: +1 화면 아래/-1 위)으로 뻗는 세 줄의 속도선
    const len = Math.round((3 + 5 * f) * sc);
    return [-1, 0, 1].map((r) => ({ x: x + r * sc * 2, y: dir > 0 ? y : y - len, w: Math.max(1, sc >> 1), h: len }));
  }
  const w = Math.round((4 + 4 * f) * sc); // 커트: 바닥에 납작하게 깔리는 한 줄
  return [{ x: x - (w >> 1), y: y + sc, w, h: Math.max(1, sc >> 1) }];
}

/** 색을 뺀 형태 서명(테스트·접근성 점검용): 색 정보 없이 기하만 문자열로 */
export function shapeSignature(spin, trail, t, bx, by, sc) {
  const f = (r) => `${r.x},${r.y},${r.w},${r.h}`;
  return [tailRects(spin, trail).map(f).join(';'), stripeRects(spin, t, bx, by, sc).map(f).join(';')].join('|');
}
