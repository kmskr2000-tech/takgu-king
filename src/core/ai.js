import { GRADES, COURSE_X } from './constants.js?v=1791280542';
import { buildTiming, judgeTap } from './timing.js?v=1791280542';
import { createShot } from './shot.js?v=1791280542';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const LEAGUES = Object.freeze(['amateur', 'third', 'second', 'first', 'world']);

/**
 * 리그별 베이스 (설계서 5.2). 모든 값 0..1.
 * returnRate: 타이밍 맞출 확률 / accuracy: 샷 정확도(실수율↓, PERFECT 확률↑)
 * spinUse: 스핀 샷 빈도 / courseAim: 빈 곳 노리는 정도 / power: 공 속도
 * amateur: 전 파라미터 낮음, third: 스핀 시작, second: 코스 공략 추가, first: 전 파라미터 중상, world: 최고
 */
export const LEAGUE_BASE = Object.freeze({
  amateur: { returnRate: 0.45, accuracy: 0.30, spinUse: 0.00, courseAim: 0.00, power: 0.25 },
  third: { returnRate: 0.55, accuracy: 0.40, spinUse: 0.30, courseAim: 0.00, power: 0.35 },
  second: { returnRate: 0.65, accuracy: 0.50, spinUse: 0.40, courseAim: 0.35, power: 0.45 },
  first: { returnRate: 0.75, accuracy: 0.62, spinUse: 0.55, courseAim: 0.55, power: 0.58 },
  world: { returnRate: 0.88, accuracy: 0.78, spinUse: 0.70, courseAim: 0.75, power: 0.72 },
});

/** 팀 내 난이도 배분 (설계서 5.3): 하위 -20%, 중위 0, 상위 +20%, 라이벌 +40% */
export const TIER_MULT = Object.freeze({ low: 0.8, mid: 1.0, high: 1.2, rival: 1.4 });

/** 10팀 중 나를 뺀 9팀의 등급: 하위3, 중위4, 상위2 (순위 index 0=가장 약함) */
export const TIER_LAYOUT = Object.freeze(['low', 'low', 'low', 'mid', 'mid', 'mid', 'mid', 'high', 'high']);

/**
 * AI 파라미터 생성. style: 'balanced' | 'cut'(커트 위주 라이벌 등)
 * 라이벌은 tier 'rival' + 고유 style 로 지정.
 */
export function makeAiParams(league, tier = 'mid', style = 'balanced') {
  const base = LEAGUE_BASE[league];
  if (!base) throw new Error(`알 수 없는 리그: ${league}`);
  const mult = TIER_MULT[tier];
  if (!mult) throw new Error(`알 수 없는 등급: ${tier}`);
  const p = { style, league, tier };
  for (const k of Object.keys(base)) p[k] = clamp(base[k] * mult, 0, 1);
  return p;
}

/** createShot 이 쓰는 스탯(1~10 스케일)으로 변환 */
export function aiStats(p) {
  return {
    power: 1 + 9 * p.power,
    spin: 1 + 9 * Math.max(p.spinUse, 0.2),
    focus: 1 + 9 * p.accuracy,
  };
}

/** 단순 종합 전투력 (확률 기반 시뮬레이션용) */
export const aiRating = (p) =>
  0.4 * p.returnRate + 0.25 * p.accuracy + 0.15 * p.power + 0.1 * p.spinUse + 0.1 * p.courseAim;

function chooseSpin(p, rng) {
  if (rng.next() >= p.spinUse && p.style !== 'cut') return 0;
  if (p.style === 'cut') return rng.next() < 0.7 ? -1 : 0; // 커트 위주
  return rng.next() < 0.75 ? 1 : -1;
}

/** 빈 곳 노리기: courseAim 확률로 상대 위치 반대편, 아니면 무작위 */
function chooseTargetX(p, rng, foeX) {
  const cols = [COURSE_X.left, COURSE_X.center, COURSE_X.right];
  if (rng.next() < p.courseAim) {
    const away = cols.slice().sort((a, b) => Math.abs(b - foeX) - Math.abs(a - foeX));
    return away[0];
  }
  return cols[Math.floor(rng.next() * 3)];
}

function buildAiShot(p, rng, side, from, hitY, grade, offset, foeX, powerCap = 1) {
  const spin = chooseSpin(p, rng);
  const aim = {
    targetX: chooseTargetX(p, rng, foeX),
    power: Math.min(powerCap, clamp(0.25 + 0.5 * p.power + 0.1 * rng.signed(), 0.1, 1)),
    spin,
  };
  if (spin < 0) aim.depth = 60;
  return createShot({
    from: { x: from, side }, aim, stats: aiStats(p), rng, grade, offset, hitY,
  });
}

/**
 * AI 서브. foeX: 상대(플레이어) 위치 추정치(기본 중앙).
 */
export function aiServe(p, rng, side, foeX = 50) {
  const x = COURSE_X.center + 20 * rng.signed();
  return buildAiShot(p, rng, side, x, null, null, 0, foeX);
}

// 탭 시각 오차(초): 리턴 성공률이 낮을수록 크고, 바닥값이 있어 완벽한 AI 도 없다.
// 빠른 공일수록 오차가 커지는 반면 판정 창은 좁아져(timing.halfTime) 파워/스핀이 AI 리턴을 어렵게 한다.
const SIGMA_FLOOR = 0.055;
const SIGMA_RANGE = 0.25;
const CUT_POWER_CAP = 0.55; // 커트를 받은 뒤엔 강타 봉쇄 (설계서 3.3)

export const tapSigma = (p, speed) =>
  (SIGMA_FLOOR + SIGMA_RANGE * (1 - p.returnRate)) * clamp(speed / 220, 0.8, 1.8);

/** 가우시안 난수 (Box-Muller) */
function gauss(rng) {
  const u = Math.max(1e-9, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/**
 * AI 응답: 들어오는 공(flight, kind 'in')에 대해 판정 + 리턴 샷을 만든다.
 * 탭 시각 = 중심 + N(0, σ), 실제 judgeTap 으로 PERFECT/GOOD/MISS 판정.
 * 반환: { judgement: {grade, offset}, shot|null, t(탭 시각, 공 발사 기준 초), timing }
 */
export function aiRespond(p, rng, side, flight, foeX = 50) {
  const timing = buildTiming(flight, aiStats(p).focus * 0.5); // AI 는 판정 폭 보정을 절반만 받는다
  const t = timing.center + gauss(rng) * tapSigma(p, Math.abs(flight.vyPost));
  const judgement = judgeTap(t, timing);
  if (judgement.grade === GRADES.MISS) return { judgement, shot: null, t, timing };
  const pos = flight.postPos(t);
  const shot = buildAiShot(
    p, rng, side, pos.x, pos.y, judgement.grade, clamp(judgement.offset, -1, 1), foeX,
    flight.spin < 0 ? CUT_POWER_CAP : 1,
  );
  return { judgement, shot, t, timing };
}
