import { GRADES, COURSE_X } from './constants.js?v=1791288146';
import { buildTiming, judgeTap } from './timing.js?v=1791288146';
import { createShot } from './shot.js?v=1791288146';

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

/** 선수 난이도 배분 (설계서 5.3): 하위 -20%, 중위 0, 상위 +20%, 라이벌 +40% */
export const TIER_MULT = Object.freeze({ low: 0.8, mid: 1.0, high: 1.2, rival: 1.4 });

/** 10명 중 나를 뺀 9명의 등급: 하위3, 중위4, 상위2 (순위 index 0=가장 약함) */
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

function chooseSpin(p, rng, boost = 0) {
  if (rng.next() >= p.spinUse + boost && p.style !== 'cut') return 0;
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

function buildAiShot(p, rng, side, from, hitY, grade, offset, foeX, powerCap = 1, { powerBonus = 0, forceSpin = null, spinBoost = 0 } = {}) {
  const spin = forceSpin ?? chooseSpin(p, rng, spinBoost);
  const aim = {
    targetX: chooseTargetX(p, rng, foeX),
    power: Math.min(powerCap, clamp(0.25 + 0.5 * p.power + 0.1 * rng.signed() + powerBonus, 0.1, 1)),
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
/**
 * 전략 템포 (튜닝 상수). 받은 공의 스핀에 따라 AI 의 대응이 달라진다:
 *  - 커트(수비)를 받으면 강타를 못 치고(파워 상한) 스핀 없이 약하게 돌려준다 → 내가 리셋하고 다음 공격을 준비
 *  - 탑스핀(공격)을 받아내면 역습: 더 세고 스핀을 쓰는 공을 돌려준다 → 내게 오는 공이 빨라져 존이 좁아진다
 * (p.counter === false 인 상대(튜토리얼 코치)는 역습하지 않는다)
 */
// 상성: 내 샷이 상대 공에 유리했으면(win) 상대 탭 오차가 커지고, 불리했으면(lose) 작아진다 (controls.js MATCHUP_FX.aiSigma 와 같은 값)
export const AI_MATCHUP_SIGMA = { win: 1.3, lose: 0.8, even: 1 };
// 상성 읽기: AI 가 내가 방금 친 샷 종류를 읽고 그 상성(나를 이기는 종류)으로 되받을 확률. 리그가 높을수록 읽는다.
// → 한 가지 샷만 반복하면 읽혀서 불리해지고, 날아오는 공 종류에 맞춰 고르는 쪽이 유리하다. (코치/튜토리얼은 league 가 없어 읽지 않는다)
export const AI_READ = { amateur: 0, third: 0.25, second: 0.4, first: 0.55, world: 0.7 };
const COUNTER_SPIN = { topspin: 0, cut: 1, normal: -1 }; // 내 샷 종류 → AI 가 고를 스핀 (내 탑스핀 ← 일반, 내 일반 ← 커트, 내 커트 ← 탑스핀)
export const AI_TEMPO = { cutPowerCap: 0.4, cutNoSpin: true, cutSigmaMult: 0.9, counterBonus: 0.45, counterSpinBoost: 0.6, spinThreshold: 0.5 };

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
export function aiRespond(p, rng, side, flight, foeX = 50, matchup = 'even', { read = true } = {}) {
  const timing = buildTiming(flight, aiStats(p).focus * 0.5); // AI 는 판정 폭 보정을 절반만 받는다
  const inSpin = flight.spin ?? 0;
  const cutIn = inSpin < -AI_TEMPO.spinThreshold; const topIn = inSpin > AI_TEMPO.spinThreshold;
  const t = timing.center + gauss(rng) * tapSigma(p, Math.abs(flight.vyPost)) * (cutIn ? AI_TEMPO.cutSigmaMult : 1) * (AI_MATCHUP_SIGMA[matchup] ?? 1);
  const judgement = judgeTap(t, timing);
  if (judgement.grade === GRADES.MISS) return { judgement, shot: null, t, timing };
  const pos = flight.postPos(t);
  const mine = inSpin > AI_TEMPO.spinThreshold ? 'topspin' : inSpin < -AI_TEMPO.spinThreshold ? 'cut' : 'normal';
  const reads = read && p.counter !== false && rng.next() < (AI_READ[p.league] ?? 0) * (TIER_MULT[p.tier] ?? 1);
  const shot = buildAiShot(
    p, rng, side, pos.x, pos.y, judgement.grade, clamp(judgement.offset, -1, 1), foeX,
    cutIn ? AI_TEMPO.cutPowerCap : 1,
    {
      forceSpin: reads ? COUNTER_SPIN[mine] : cutIn && AI_TEMPO.cutNoSpin ? 0 : null,
      powerBonus: topIn && p.counter !== false ? AI_TEMPO.counterBonus : 0,
      spinBoost: topIn && p.counter !== false ? AI_TEMPO.counterSpinBoost : 0,
    },
  );
  return { judgement, shot, t, timing };
}
