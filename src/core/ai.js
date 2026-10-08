import { GRADES, COURSE_X, AI_PERFECT_RATIO, AI_BAD_FRACTION } from './constants.js?v=1791424546';
import { buildTiming, judgeTap } from './timing.js?v=1791424546';
import { MIN_REACTION_S } from './constants.js?v=1791424546';
import { createShot, flightOf, powerCap } from './shot.js?v=1791424546';

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
// 스탯 곡선(game/statcurve.js)이 수확체감이라 플레이어 상한이 정해졌다. 그래서 3부 이상 AI 의 returnRate·accuracy 에 리그별 가산을 더해 상위 리그 긴장감을 유지한다
// (2026-10-07 유저 피드백 "스탯을 찍으면 너무 쉬워진다", scripts/tune-balance.mjs 로 확정).
// 가산은 등급 배율을 적용한 뒤에 더한다(등급별 반영 비율 TIER_UPLIFT_SHARE, 기본 전부 1).
export const LEAGUE_UPLIFT = { amateur: 0, third: 0.10, second: 0.09, first: 0.02, world: -0.03 };
export const TIER_UPLIFT_SHARE = { low: 1, mid: 1, high: 1, rival: 1 };
// 상위 리그는 기본값이 이미 높아 등급 배율(×0.8~×1.4)이 clamp 로 뭉개져 상위·라이벌이 벽이 된다 → 리그별로 배율의 편차를 줄인다 (1 = 기존). 확정값 기준 시즌 후반 승률(사람 전략·skill 0.17): 3부 97/87/65/53 · 2부 93/83/63/37 · 1부 93/77/53/25 · 세계 75/53/45/27 (하위/중위/상위/라이벌 %). 2026-10-07 커트 득점 루트(cutNoise 4.3)·1부 캡·PERFECT 구간 축소(0.3→0.15, 플레이어만) 후 재보정(scripts/tune-balance.mjs --n 250 --skill 0.17 실측(최종 가산 기준), 하위/중위/상위/라이벌): 3부 96/90/80/56 · 2부 96/92/74/48 · 1부 98/86/58/29 · 세계 78/66/54/57 — 목표보다 전반적으로 쉽다(3부 상위 +15, 세계 중위 +13·라이벌 +30). 주의: 이 봇은 탭 오차 σ0.17s 의 서투른 플레이어이고, σ0.06s(보통 사람) 봇은 모든 리그·등급에서 100% 이긴다 — 정밀한 플레이어에겐 아직 쉽다. AI 끼리 리그 사다리(상위 리그가 하위 리그를 이김)는 test/strategy.test.js 가 지킨다
export const TIER_SPREAD = { amateur: 1, third: 0.65, second: 0.5, first: 0.5, world: 0.22 };

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
  const mult0 = TIER_MULT[tier];
  if (!mult0) throw new Error(`알 수 없는 등급: ${tier}`);
  const mult = 1 + (mult0 - 1) * (TIER_SPREAD[league] ?? 1);
  const p = { style, league, tier, variety: LEAGUE_VARIETY[league] ?? 0 };
  if (tier === 'rival') p.rhythm = RIVAL_RHYTHM[league];
  const up = (LEAGUE_UPLIFT[league] ?? 0) * (TIER_UPLIFT_SHARE[tier] ?? 0);
  for (const k of Object.keys(base)) p[k] = clamp(base[k] * mult + (k === 'returnRate' || k === 'accuracy' ? up : 0), 0, 1);
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
  if (rng.next() >= Math.max(p.spinUse, p.variety ?? 0) + boost && p.style !== 'cut') return 0;
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

// 제어 가능한 파워 상한 (플레이어와 같은 규칙, shot.js powerCap): 하위 리그(아마추어~2부) AI 가 역습 보너스로 자기 능력 밖 강타를 쳐서 스스로 아웃나는 것을 막는다.
// → 하위 리그도 랠리가 이어지고(스팸 한 가지 샷으로 AI 자멸을 기다릴 수 없다) 공은 여전히 느리다. 상위 리그는 거의 영향 없음.
export const CAPPED_LEAGUES = new Set(['amateur', 'third', 'second', 'first']); // 1부도 캡: 캡이 없으면 AI 역습 강타의 자멸(네트·아웃 15%)로 탑스핀만 쳐도 75% 승 (2026-10-07 피드백 ② 구질 일변도). 세계대회만 기존 유지
const controllable = (p, spin, power, on) => (on && CAPPED_LEAGUES.has(p.league) ? Math.min(power, powerCap(aiStats(p), spin)) : power);

function buildAiShot(p, rng, side, from, hitY, grade, offset, foeX, powerCap = 1, { powerBonus = 0, forceSpin = null, spinBoost = 0, capPower = false, noise = 1 } = {}) {
  const spin = forceSpin ?? chooseSpin(p, rng, spinBoost);
  const aim = {
    targetX: chooseTargetX(p, rng, foeX),
    power: Math.min(powerCap, controllable(p, spin, clamp(0.25 + 0.5 * p.power + (p.rhythm?.tempoBase ?? 0) + (p.rhythm?.tempoVar ?? 0.1) * (p.rhythmMult ?? 1) * rng.signed() + powerBonus, 0.1, 1), capPower)),
    spin,
  };
  if (spin < 0) aim.depth = 60;
  const shotRng = noise === 1 ? rng : { next: rng.next, signed: () => rng.signed() * noise }; // 실수 난수만 배율 (코스·스핀 선택 난수는 그대로)
  const make = () => createShot({ from: { x: from, side }, aim, stats: aiStats(p), rng: shotRng, grade, offset, hitY });
  let shot = make();
  // 공정성 하한(설계안 §6.4): 바운드 → 밴드 중심이 MIN_REACTION_S 보다 짧은 공은 만들지 않는다 (파워를 낮춰 다시)
  for (let i = 0; i < 6; i++) {
    const f = flightOf(shot);
    if (f.kind !== 'in' || buildTiming(f, 0).center - f.tLand >= MIN_REACTION_S) break;
    aim.power = Math.max(0.1, aim.power - 0.08); shot = make();
  }
  return shot;
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
// 상성 × 내 타격 등급 (간단 조작·상성 사용 시, 리듬 재설계 v2): 타이밍 정확도(PERFECT)가 상성보다 우선하도록 PERFECT 압박을 상성과 곱으로 준다.
// 키 `${상성}:${등급}`. 시뮬(scripts/sim-matchup.mjs): 유리+GOOD 보다 중립+PERFECT 가 더 압박적이어야 한다.
Object.assign(AI_MATCHUP_SIGMA, {
  'win:PERFECT': 1.6, 'win:GOOD': 1.25, 'even:PERFECT': 1.25, 'even:GOOD': 1, 'lose:PERFECT': 1.1, 'lose:GOOD': 0.9,
  'win:BAD': 1.0, 'even:BAD': 0.8, 'lose:BAD': 0.7, // BAD(아슬아슬) 타격은 위력이 약해 상대가 받기 쉽다
});
// 상성 읽기: AI 가 내가 방금 친 샷 종류를 읽고 그 상성(나를 이기는 종류)으로 되받을 확률. 리그가 높을수록 읽는다.
// → 한 가지 샷만 반복하면 읽혀서 불리해지고, 날아오는 공 종류에 맞춰 고르는 쪽이 유리하다. (코치/튜토리얼은 league 가 없어 읽지 않는다)
export const AI_READ = { amateur: 0.9, third: 0.9, second: 0.8, first: 0.55, world: 0.7 };
// 읽는 속도 (하위 리그 밸런스): 내가 같은 종류를 연속 N번 이상 써야 AI 가 확률 100% 로 편중을 읽는다. 약한 리그일수록 N 이 커서 천천히 읽는다.
// 읽기 확률 = AI_READ × 등급 × min(1, 연속 횟수 / N). N=1 이면 매번(기존 동작). streak 를 안 넘기면(AI끼리·구 코드) 기존 동작.
export const AI_READ_NEED = { amateur: 3, third: 3, second: 2, first: 1, world: 1 };
// 구질 다양성 하한: 낮은 리그도 스핀(탑스핀/커트)을 섞어 쳐서 "공 읽기 → 샷 고르기" 연습이 되게 한다. 속도(power)는 리그 기준대로 느리다.
// 예상 반응: 편중(연속 2회+)을 읽은 AI 의 탭 오차 배율. 낮을수록 잘 받아낸다.
// 최하위권(low 등급) 스팸 억제 (약하게): 등급 배율(×0.8)로 읽기가 너무 둔해져 한 가지 샷 반복이 통하던 것을 보정 — 조금 더 일찍·확실하게 읽는다. '쉽다'는 유지(AI 정확도·반응은 그대로).
export const LOW_TIER_READ = { need: 0.67, prob: 1.15 };
export const AI_READ_ANTICIPATE = 0.3;
export const AI_ANTICIPATE_FROM = { amateur: 2, third: 2, second: 3, first: 4, world: 4 }; // 연속 몇 번째부터 예상하나 (상위 리그는 상성 전략의 자연스러운 반복과 겹치지 않게 길게)
// 리듬 시그니처 (설계안 §6.3, 라이벌 전용): tempoVar = 공 속도(파워) 변동폭(기본 0.1), tempoBase = 기본 템포 가산.
// 모든 변칙은 MIN_REACTION_S(공정성 하한) 아래로 내려가지 않는다 — buildAiShot 이 강제.
export const RIVAL_RHYTHM = {
  amateur: { tempoVar: 0.03, tempoBase: 0 }, // 오순자(철벽 오여사): 규칙적·안정
  third: { tempoVar: 0.06, tempoBase: 0.1 }, // 고등학생 천재: 고템포로 몰아침
  second: { tempoVar: 0.18, tempoBase: 0 }, // 전직 실업팀: 노련한 템포 변화
  first: { tempoVar: 0.16, tempoBase: 0.04 }, // 국가대표 후보: 복합
  world: { tempoVar: 0.2, tempoBase: 0.04 }, // 황제: 고도 변칙(읽기 어렵지만 가능 — 하한 준수)
};
export const LEAGUE_VARIETY = { amateur: 0.35, third: 0.35, second: 0.4, first: 0.55, world: 0.7 };
const COUNTER_SPIN = { topspin: 0, cut: 1, normal: -1 }; // 내 샷 종류 → AI 가 고를 스핀 (내 탑스핀 ← 일반, 내 일반 ← 커트, 내 커트 ← 탑스핀)
// cutNoise: 백스핀(커트) 공을 받아칠 때 AI 샷 실수 난수 배율(>1 이면 네트/아웃이 늘어 커트가 득점 루트가 된다). topSigmaMult: 탑스핀 공 탭 오차 배율(<1 이면 받아내기 쉬워져 탑스핀 일변도를 막는다). 1 이면 기존과 동일
export const AI_TEMPO = { cutPowerCap: 0.4, cutNoSpin: true, cutSigmaMult: 1.15, cutNoise: 4.3, topSigmaMult: 0.85, counterBonus: 0.45, counterSpinBoost: 0.6, spinThreshold: 0.5 };

// 방향 전환 효과: AI 는 자기가 마지막으로 친 자리(oppX)에 서 있다. 내 공이 그 자리에서 멀리 떨어질수록(코스 반대쪽) 닿기 어려워 탭 오차가 커지고,
// 바로 앞(같은 쪽)이면 받기 쉽다. 코스 거리 dist(0..1, 코트 폭 비율)에 대한 탭 오차 배율 = base + slope × dist.
// 코스 3칸 균등이면 평균 ≈ 1 이 되게 잡았다(전체 난이도는 그대로, 코스 선택만 보상/벌). 코치(counter === false)·oppX 미지정(AI 끼리·구 코드)은 적용 안 함.
export const DIRECTION_FX = { base: 0.9, slope: 0.7 };
export const reachMult = (landX, oppX) => (oppX == null ? 1 : DIRECTION_FX.base + DIRECTION_FX.slope * Math.min(1, Math.abs(landX - oppX) / 100));

// 패턴 읽기 (싱글, 2026-10-08 확정): AI 는 내 최근 코스(왼/가운데/오른쪽) window 개를 기억해 가장 많이 친 쪽을 예측한다(need 개 이상 쌓였을 때).
// 예측 적중(hit) → 탭 오차 ×hit(리턴 성공률↑), 방향 전환으로 예측이 깨지면(broken) → 탭 오차 ×broken + 탭이 halfTime×delay 만큼 늦어짐(반응 지연).
// 읽는 확률은 리그·등급별 AI_READ 와 같다(코치·약한 리그는 덜 읽는다).
export const AI_PATTERN = { window: 4, need: 2, hit: 0.75, broken: 1.3, delay: 0.2 };
export const courseZone = (x) => (x < 35 ? 'L' : x > 65 ? 'R' : 'C');
/** 코스 기록(최근순 배열 아님, 오래된→최신) → 예측 구역 또는 null */
export function predictZone(hist) {
  if (hist.length < AI_PATTERN.need) return null;
  const n = { L: 0, C: 0, R: 0 }; for (const z of hist.slice(-AI_PATTERN.window)) n[z]++;
  const best = Object.entries(n).sort((a, b) => b[1] - a[1]);
  return best[0][1] > best[1][1] ? best[0][0] : null; // 동률이면 예측 불가
}

// 필살기(3연속 PERFECT 다음 샷)를 받는 AI 의 탭 오차 배율: 자동 득점이 아니라 "매우 강한 샷" — 리그가 높을수록 낮은 확률로 받아낸다 (scripts/sim-special.mjs 로 확정)
export const SPECIAL_SIGMA = { amateur: 2.6, third: 2.7, second: 2.8, first: 3.0, world: 3.2 };

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
export function aiRespond(p, rng, side, flight, foeX = 50, matchup = 'even', { read = true, streak = null, capPower = streak != null, oppX = null, special = false, pattern = null } = {}) {
  const timing = buildTiming(flight, aiStats(p).focus * 0.5, { bad: true, perfectRatio: AI_PERFECT_RATIO, badFraction: AI_BAD_FRACTION }); // AI 는 판정 폭 보정을 절반만 받는다 (AI 도 같은 4단계 등급)
  const inSpin = flight.spin ?? 0;
  const cutIn = inSpin < -AI_TEMPO.spinThreshold; const topIn = inSpin > AI_TEMPO.spinThreshold;
  const slow = streak == null ? 1 : Math.min(1, streak / Math.max(0.5, (AI_READ_NEED[p.league] ?? 1) * (p.readNeedMult ?? 1) * (p.tier === 'low' ? LOW_TIER_READ.need : 1))); // 읽는 속도: 연속으로 쓸수록 확실히 읽는다
  const reads = read && p.counter !== false && rng.next() < Math.min(0.95, (AI_READ[p.league] ?? 0) * (TIER_MULT[p.tier] ?? 1) * (p.readProbMult ?? 1) * (p.tier === 'low' ? LOW_TIER_READ.prob : 1)) * slow;
  // 같은 종류를 되풀이하면(연속 N회 이상) 읽은 AI 는 그 공을 예상하고 있다 → 탭 오차가 줄어 더 잘 받아낸다 (스팸 억제)
  const anticipate = reads && streak != null && streak >= (AI_ANTICIPATE_FROM[p.league] ?? 3) ? AI_READ_ANTICIPATE : 1;
  // 패턴 읽기: 예측 적중이면 더 잘 받고, 깨지면 흔들리고 늦는다 (읽은 경우에만)
  const patRead = pattern && p.counter !== false && rng.next() < Math.min(0.95, (AI_READ[p.league] ?? 0) * (TIER_MULT[p.tier] ?? 1));
  const patMult = patRead ? (pattern === 'hit' ? AI_PATTERN.hit : AI_PATTERN.broken) : 1;
  const patDelay = patRead && pattern === 'broken' ? timing.halfTime * AI_PATTERN.delay : 0;
  const t = patDelay + timing.center + gauss(rng) * tapSigma(p, Math.abs(flight.vyPost)) * (cutIn ? AI_TEMPO.cutSigmaMult : topIn ? AI_TEMPO.topSigmaMult : 1) * (AI_MATCHUP_SIGMA[matchup] ?? 1) * anticipate * patMult * (p.reactMult ?? 1) * (special ? SPECIAL_SIGMA[p.league] ?? 2 : 1) * (p.counter === false ? 1 : reachMult(flight.land?.x ?? oppX, oppX));
  const judgement = judgeTap(t, timing);
  if (judgement.grade === GRADES.MISS) return { judgement, shot: null, t, timing };
  const pos = flight.postPos(t);
  const mine = inSpin > AI_TEMPO.spinThreshold ? 'topspin' : inSpin < -AI_TEMPO.spinThreshold ? 'cut' : 'normal';
  const shot = buildAiShot(
    p, rng, side, pos.x, pos.y, judgement.grade, clamp(judgement.offset, -1, 1), foeX,
    cutIn ? AI_TEMPO.cutPowerCap : 1,
    {
      forceSpin: reads ? COUNTER_SPIN[mine] : cutIn && AI_TEMPO.cutNoSpin ? 0 : null,
      powerBonus: topIn && p.counter !== false ? AI_TEMPO.counterBonus : 0,
      spinBoost: topIn && p.counter !== false ? AI_TEMPO.counterSpinBoost : 0,
      capPower,
      noise: cutIn ? AI_TEMPO.cutNoise : 1,
    },
  );
  return { judgement, shot, t, timing };
}
