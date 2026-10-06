import {
  DRAG_MIN_FRAC, DRAG_FULL_FRAC, DRAG_MIN_PX, TAP_POWER, DRAG_VERTICAL_RATIO, COURSE_X,
} from './constants.js?v=1791287394';

/** 코트 폭(px)에 맞춘 드래그 기준 (최소/풀파워) */
export const dragThresholds = (courtWidth) => ({
  min: Math.max(DRAG_MIN_PX, DRAG_MIN_FRAC * courtWidth),
  full: Math.max(DRAG_MIN_PX * 4, DRAG_FULL_FRAC * courtWidth),
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 탭 x 위치(코트 폭 대비 0..1 로 정규화) → 'left' | 'center' | 'right' */
export function courseOf(xNorm) {
  const x = clamp(xNorm, 0, 1);
  if (x < 1 / 3) return 'left';
  if (x > 2 / 3) return 'right';
  return 'center';
}

/**
 * 제스처 분류. 입력: down 지점/시각, up 지점, 코트 폭(px). 화면 y는 아래로 증가.
 * - 위로 드래그 = 탑스핀(+1), 아래로 = 커트(-1, 백스핀), 그 외 = 무회전
 * - 파워: 탭 TAP_POWER, 드래그는 길이에 비례해 1.0 까지
 * - 가로 위주 드래그는 스핀 없이 코스만 (탭 위치 기준)
 */
export function classifyGesture({ down, up, courtWidth }) {
  const dx = up.x - down.x;
  const dy = up.y - down.y;
  const len = Math.hypot(dx, dy);
  const course = courseOf(down.x / courtWidth);
  const { min: DRAG_MIN, full: DRAG_FULL } = dragThresholds(courtWidth);

  let spin = 0;
  const vertical = Math.abs(dy) >= DRAG_MIN && Math.abs(dy) >= Math.abs(dx) * DRAG_VERTICAL_RATIO;
  if (vertical) spin = dy < 0 ? 1 : -1;

  let power = TAP_POWER;
  if (len >= DRAG_MIN) {
    power = TAP_POWER + (1 - TAP_POWER) * clamp((len - DRAG_MIN) / (DRAG_FULL - DRAG_MIN), 0, 1);
  }
  return { course, spin, power, length: len, tapTime: down.t, isTap: len < DRAG_MIN };
}

/** 제스처 → createShot 의 aim. 커트는 짧게 놓는다. */
export function gestureToAim(g) {
  const aim = { targetX: COURSE_X[g.course], power: g.power, spin: g.spin };
  if (g.spin < 0) aim.depth = 60;
  return aim;
}

/**
 * 포인터 추적기: 첫 포인터만 인정(멀티터치 무시), down 시점에 탭 시각 확정.
 * onDown 콜백은 down 즉시 호출되어 타이밍 판정에 쓰인다 (샷 방향은 up 에서 확정).
 */
export function createGestureTracker({ courtWidth, onDown = null }) {
  let active = null; // { id, down }
  return {
    down(id, x, y, t) {
      if (active) return false;
      active = { id, down: { x, y, t } };
      if (onDown) onDown(active.down);
      return true;
    },
    move() {}, // 분류는 up 에서 일괄 (미리보기가 필요하면 확장)
    up(id, x, y) {
      if (!active || active.id !== id) return null;
      const { down } = active;
      active = null;
      return classifyGesture({ down, up: { x, y }, courtWidth });
    },
    cancel(id) {
      if (active && active.id === id) active = null;
    },
    get busy() {
      return active !== null;
    },
  };
}
