import {
  ZONE_OFFSET, ZONE_HALF, PERFECT_RATIO, FOCUS_WIDEN, MIN_HALF_TIME, BOUNCE_GRACE, GRADES,
} from './constants.js?v=1791275435';

/**
 * 받는 쪽 타이밍 창 계산. flight 는 simulateFlight 결과(kind 'in').
 * 시간 t 는 상대가 공을 친 시점(0)부터의 초.
 * 집중 스탯이 판정 폭을 넓힌다.
 */
export function buildTiming(flight, focus = 0) {
  if (flight.kind !== 'in') throw new Error('타이밍 창은 코트에 들어온 공에만 만들 수 있다');
  const speed = Math.abs(flight.vyPost);
  const half = ZONE_HALF * (1 + FOCUS_WIDEN * Math.max(0, focus));
  const halfTime = Math.max(MIN_HALF_TIME, half / speed);
  // 존 중심 도달 시각. 창 전체가 바운드 이후여야 한다 (1회 바운드 후 리턴 규칙)
  const center = flight.tLand + BOUNCE_GRACE + halfTime + ZONE_OFFSET / speed;
  return {
    center,
    halfTime,
    start: center - halfTime,
    end: center + halfTime,
    perfectHalf: halfTime * PERFECT_RATIO,
    // 렌더링용: 존 중심의 월드 좌표와 반폭
    zone: { x: flight.postPos(center).x, y: flight.postPos(center).y, half },
  };
}

/** 탭 시각 → 판정. 구간 밖이면 MISS. offset 은 -1..1 (중심 0, 존 끝 ±1). */
export function judgeTap(tTap, timing) {
  const offset = (tTap - timing.center) / timing.halfTime;
  const abs = Math.abs(offset);
  if (abs > 1) return { grade: GRADES.MISS, offset };
  if (abs <= PERFECT_RATIO) return { grade: GRADES.PERFECT, offset };
  return { grade: GRADES.GOOD, offset };
}

/** 노탭 판정: 존이 끝난 시점. 항상 MISS. */
export const judgeNoTap = (timing) => ({ grade: GRADES.MISS, offset: Infinity, at: timing.end });
