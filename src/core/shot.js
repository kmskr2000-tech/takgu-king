import {
  NET_Y, HIT_Z, SPEED_MIN, SPEED_MAX, SPIN_SPEED_TOP, SPIN_SPEED_BACK, GRADES,
} from './constants.js?v=1791335595';
import { gravityFor, simulateFlight } from './physics.js?v=1791335595';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * 컨트롤 가능한 파워 상한. 파워/스핀 스탯이 높을수록, 탑스핀을 걸수록 큰 파워를 제어할 수 있다.
 * 이 값을 넘는 파워는 보정 없이 날아가 아웃 위험이 커진다 (설계서 4.2).
 */
export function powerCap(stats, spin) {
  return clamp(0.4 + 0.05 * stats.power + 0.05 * stats.spin * Math.max(0, spin), 0, 1);
}

const spinSpeedMult = (spin) => {
  const s = clamp(spin, -1, 1);
  return s >= 0 ? 1 + SPIN_SPEED_TOP * s : 1 + SPIN_SPEED_BACK * s;
};

const speedFor = (power, spin) =>
  (SPEED_MIN + (SPEED_MAX - SPEED_MIN) * clamp(power, 0, 1)) * spinSpeedMult(spin);

/** 판정 등급에 따른 샷 보정 (PERFECT: 파워/스핀 보너스, 오차 감소) */
export function gradeModifier(grade, offset = 0) {
  if (grade === GRADES.PERFECT) return { power: 1.15, spin: 1.2, error: 0.5 };
  if (grade === GRADES.BAD) return { power: 0.85, spin: 0.9, error: 2.0 }; // 아슬아슬: 위력↓ 오차↑
  return { power: 1, spin: 1, error: 0.8 + 0.8 * Math.min(1, Math.abs(offset)) };
}

/**
 * 샷 생성.
 * from: { x, side }  side 'me'(y=170에서 위로) | 'opp'(y=30에서 아래로)
 * aim:  { targetX(0..100), depth(네트로부터 거리, 기본 70), power(0..1), spin(-1..1) }
 * stats: { power, spin, focus }
 * rng: createRng() — 실수 오차용. 생략하면 오차 없음.
 * grade: 판정 보정 (서브는 생략)
 * 의도한 착지는 (파워 상한 내) 계산되고, 파워 초과분과 난수 오차가 실제 궤적에 반영된다.
 */
export function createShot({ from, aim, stats, rng = null, grade = null, offset = 0, hitY = null }) {
  const dir = from.side === 'me' ? -1 : 1;
  const mod = grade ? gradeModifier(grade, offset) : { power: 1, spin: 1, error: 1 };
  const spin = clamp(aim.spin * mod.spin, -1, 1);
  const power = clamp(aim.power * mod.power, 0, 1);
  const y0 = hitY ?? (dir < 0 ? 170 : 30);
  const targetY = NET_Y + dir * (aim.depth ?? 70);

  // 의도 계산: 제어 가능한 파워까지만 보정
  const aimSpeed = speedFor(Math.min(power, powerCap(stats, spin)), spin);
  const g = gravityFor(spin);
  const T = Math.abs(targetY - y0) / aimSpeed;
  const vz = (0.5 * g * T * T - HIT_Z) / T;
  const vx = (aim.targetX - from.x) / T;

  // 실제 속도: 초과 파워는 그대로 반영 → 길게 날아감
  const speed = speedFor(power, spin);
  // 실수 오차: 집중 스탯이 줄이고 판정이 줄인다
  const errScale = 0.13 * Math.max(0.2, 1 - 0.06 * stats.focus) * mod.error;
  const nz = rng ? rng.signed() * errScale : 0;
  const nx = rng ? rng.signed() * errScale * 120 : 0;

  return {
    side: from.side,
    dir,
    power,
    spin,
    ball: {
      x: from.x,
      y: y0,
      z: HIT_Z,
      vx: vx + nx,
      vy: dir * speed,
      vz: vz * (1 + nz),
      spin,
    },
  };
}

/** 샷 → 비행 결과 */
export const flightOf = (shot) => simulateFlight(shot.ball, shot.dir);
