import {
  ZONE_OFFSET, ZONE_HALF, PERFECT_RATIO, BAD_FRACTION, FOCUS_WIDEN, MIN_HALF_TIME, BOUNCE_GRACE, GRADES,
} from './constants.js?v=1791366989';

/**
 * 받는 쪽 타이밍 창 계산. flight 는 simulateFlight 결과(kind 'in').
 * 시간 t 는 상대가 공을 친 시점(0)부터의 초.
 * 집중 스탯이 판정 폭을 넓힌다.
 * shift(기본 0): 밴드 중심을 halfTime 의 shift 배만큼 이동(구질별 리듬: 음수=이르게, 양수=늦게). 중심·PERFECT 구간·판정 범위가 같이 움직인다. 0 이면 기존과 동일.
 * leniency(기본 1): 조작 난이도 완화용. center/halfTime/perfectHalf(= 타격 지점과 PERFECT 구간)는 그대로 두고,
 *   탭을 받아주는 범위(start~end)만 center ± leniency*halfTime 으로 넓힌다. 시작은 바운드 직후(+유예) 아래로 내려가지 않는다.
 *   → 슛의 타격 위치(hitY)와 오차 매핑은 변하지 않아 밸런스·손맛이 유지된다. AI 는 항상 1.
 */
export function buildTiming(flight, focus = 0, { leniency = 1, shift = 0, bad = false, perfectRatio = PERFECT_RATIO, badFraction = BAD_FRACTION } = {}) {
  if (flight.kind !== 'in') throw new Error('타이밍 창은 코트에 들어온 공에만 만들 수 있다');
  const speed = Math.abs(flight.vyPost);
  const half = ZONE_HALF * (1 + FOCUS_WIDEN * Math.max(0, focus));
  const halfTime = Math.max(MIN_HALF_TIME, half / speed);
  // 존 중심 도달 시각. 창 전체가 바운드 이후여야 한다 (1회 바운드 후 리턴 규칙)
  const center = flight.tLand + BOUNCE_GRACE + halfTime + ZONE_OFFSET / speed + shift * halfTime;
  const lo = Math.max(center - halfTime * leniency, flight.tLand + BOUNCE_GRACE);
  const hi = center + halfTime * leniency;
  const perfectHalf = halfTime * perfectRatio;
  const at = (t) => flight.postPos(t);
  return {
    center,
    halfTime,
    leniency,
    perfectRatio, badFraction,
    bad, // true 면 judgeTap 이 바깥쪽 BAD_FRACTION 이후를 BAD 로 판정한다 (4단계 등급)
    start: lo,
    end: hi,
    perfectHalf,
    // 렌더링용: 존 중심의 월드 좌표와 반폭(구버전 호환) + 실제로 탭을 받아주는 범위/PERFECT 범위의 코트 y 좌표
    zone: {
      x: at(center).x, y: at(center).y, half,
      yStart: at(lo).y, yEnd: at(hi).y,
      yPerfectStart: at(center - perfectHalf).y, yPerfectEnd: at(center + perfectHalf).y,
    },
  };
}

/**
 * 탭 시각 → 판정. 받아주는 범위(start~end) 밖이면 MISS.
 * offset 은 중심 0 기준, 존 끝(= 난이도 1배 기준 범위)이 ±1. 완화 범위 안의 탭은 offset 이 1을 넘을 수 있고 GOOD 으로 처리한다.
 */
export function judgeTap(tTap, timing) {
  const offset = (tTap - timing.center) / timing.halfTime;
  const abs = Math.abs(offset);
  const lenient = timing.leniency ?? 1;
  if (abs > lenient || tTap < timing.start) return { grade: GRADES.MISS, offset };
  if (abs <= (timing.perfectRatio ?? PERFECT_RATIO)) return { grade: GRADES.PERFECT, offset };
  if (timing.bad && abs > lenient * (timing.badFraction ?? BAD_FRACTION)) return { grade: GRADES.BAD, offset };
  return { grade: GRADES.GOOD, offset };
}

/** 노탭 판정: 존이 끝난 시점. 항상 MISS. */
export const judgeNoTap = (timing) => ({ grade: GRADES.MISS, offset: Infinity, at: timing.end });
