import {
  TABLE_W, NET_Y, NET_H, HIT_Z, G, SPIN_G, REST_Y, SPIN_KICK, REST_MIN, REST_X,
} from './constants.js?v=1791366989';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 스핀(-1 백스핀 .. +1 탑스핀)에 따른 유효 중력
export const gravityFor = (spin) => G * (1 + SPIN_G * clamp(spin, -1, 1));

/**
 * 공 한 번의 비행(타구 → 바운드)을 해석적으로 계산한다. DOM 무관, 순수 함수.
 * ball: { x, y, vx, vy, vz, spin, z? }  (z 기본 HIT_Z)
 * dir: 진행 방향 부호 (-1: 내 쪽→상대 쪽, +1: 상대 쪽→내 쪽)
 * 결과 kind: 'in' | 'net' | 'out'
 */
export function simulateFlight(ball, dir) {
  const z0 = ball.z ?? HIT_Z;
  const g = gravityFor(ball.spin);
  const { x: x0, y: y0, vx, vy, vz } = ball;

  const zAt = (t) => z0 + vz * t - 0.5 * g * t * t;
  const tLand = (vz + Math.sqrt(vz * vz + 2 * g * z0)) / g;
  const xLand = x0 + vx * tLand;
  const yLand = y0 + vy * tLand;
  const tNet = (NET_Y - y0) / vy; // vy 방향이 맞으면 양수

  const base = {
    dir,
    spin: ball.spin,
    tLand,
    apex: z0 + (vz > 0 ? (vz * vz) / (2 * g) : 0),
    land: { x: xLand, y: yLand },
    pos: (t) => ({ x: x0 + vx * t, y: y0 + vy * t, z: Math.max(0, zAt(t)) }),
  };

  // 네트: 네트 평면 도달 전에 떨어지거나, 네트 높이보다 낮게 통과
  if (tNet > 0) {
    if (tNet >= tLand || zAt(tNet) < NET_H) {
      return { ...base, kind: 'net', tNet, zNet: zAt(tNet) };
    }
  }

  // 아웃: 상대(받는 쪽) 코트 밖에 착지
  const inX = xLand >= 0 && xLand <= TABLE_W;
  const inY = dir < 0 ? yLand >= 0 && yLand <= NET_Y : yLand >= NET_Y && yLand <= 2 * NET_Y;
  if (!inX || !inY) return { ...base, kind: 'out', tNet, zNet: zAt(tNet) };

  // 바운드 후 속도: 탑스핀은 가속, 백스핀은 감속
  const rest = clamp(REST_Y + SPIN_KICK * ball.spin, REST_MIN, 1.2);
  const vyPost = vy * rest;
  const vxPost = vx * REST_X;
  return {
    ...base,
    kind: 'in',
    tNet,
    zNet: zAt(tNet),
    vyPost,
    vxPost,
    // 바운드 후 공의 위치 (t: 타구 시점부터의 초)
    postPos: (t) => ({ x: xLand + vxPost * (t - tLand), y: yLand + vyPost * (t - tLand) }),
  };
}
