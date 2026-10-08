// 조작 방식. 간단(기본): 탭 한 번이 곧 샷 — 코스는 탭 위치, 샷 종류는 미리 고른 버튼. 고급: 탭 + 쓸기(스핀/파워).
export const CONTROL_MODES = Object.freeze({
  simple: { label: '간단', desc: '샷 버튼을 누르는 순간이 스윙. 코스는 코트를 탭해 정하고, 샷 종류는 상대 공을 보고 골라요' },
  advanced: { label: '고급', desc: '탭하면서 위/아래로 쓸어 스핀·파워를 직접 조절 (기존 방식)' },
});
export const CONTROL_ORDER = Object.freeze(['simple', 'advanced']);
export const DEFAULT_CONTROL_MODE = 'simple';

/**
 * 간단 조작의 샷 종류. power/spin 은 스탯 3~14 전 구간 실측(GOOD·PERFECT)에서 성공률이 스탯에 따라 내려가지 않는 값만 쓴다
 * (test/controls.test.js 가 이 단조성을 계속 검사한다). 0.65 이상은 PERFECT 보너스와 겹쳐 스탯이 높을수록 네트에 걸려서 제외했다.
 */
export const SHOT_TYPES = Object.freeze({
  // 전략적 역할 (수치는 test/strategy.test.js 의 시뮬레이션으로 검증):
  //  - leniency: 내 타이밍 존(받아주는 범위) 배율 / error: 샷 오차 배율 → 공격은 위험(좁고 흔들림), 수비는 안정(넓고 정확)
  //  - 탑스핀(공격·위험): 빠른 공으로 상대를 압박하지만, 존이 좁고 막히면 상대가 역습한다(AI_TEMPO.counter*)
  //  - 커트(수비·안정): 존이 넓고 안전, 상대는 약하게·스핀 없이 돌려준다(리셋). 단 커트만으로는 점수를 못 낸다
  normal: { label: '일반', tag: '기본', power: 0.5, spin: 0, leniency: 1.0, error: 1.0, desc: '탑스핀 공에 강함', color: '#f4f4f4' },
  topspin: { label: '탑스핀', tag: '공격·위험', power: 0.6, spin: 1, leniency: 0.7, error: 2.0, desc: '커트 공에 강함 · 역습 주의', color: '#ff5a4a' },
  // 커트 파워 0.5: 파워 0.8 은 제어 상한(0.65)을 넘어 깊이 날아가 늦은 타이밍에 아웃이 났다 (어느 타격 위치에서도 목표에 100% 착지)
  cut: { label: '커트', tag: '수비·안정', power: 0.5, spin: -1, depth: 60, leniency: 1.4, error: 0.5, desc: '일반 공에 강함', color: '#4aa3ff' },
});

/** 상대 공의 빠르기(바운드 후 속도): 상황 판단 안내용. fast → 커트로 리셋, slow → 탑스핀 공격 기회 */
export const BALL_SPEED_CLASS = Object.freeze({ fast: 260, slow: 150 });
export function ballSpeedClass(speed) { return speed >= BALL_SPEED_CLASS.fast ? 'fast' : speed <= BALL_SPEED_CLASS.slow ? 'slow' : 'normal'; }

export const SHOT_ORDER = Object.freeze(['normal', 'topspin', 'cut']);
export const DEFAULT_SHOT_TYPE = 'normal';
export const shotTypeOf = (key) => SHOT_TYPES[key] ?? SHOT_TYPES[DEFAULT_SHOT_TYPE];

/** 간단 조작: 코스(targetX) + 샷 종류 → createShot 의 aim */
export function simpleAim(targetX, shotKey) {
  const t = shotTypeOf(shotKey);
  const aim = { targetX, power: t.power, spin: t.spin };
  if (t.depth != null) aim.depth = t.depth;
  return aim;
}

/**
 * 상성(가위바위보): 탑스핀 > 커트 > 일반 > 탑스핀.
 *  - 탑스핀은 느린 커트볼을 공격한다 / 커트는 일반 공을 낮게 깔아 죽인다 / 일반(블록)은 빠른 탑스핀의 힘을 되돌린다
 * 상대가 친 공의 종류(스핀)를 보고 내 샷을 고른다. 유리하면 샷이 안정적이고 상대가 흔들리며(밴드 폭은 그대로), 불리하면 실수 위험이 커진다.
 * (간단 조작 전용 — 고급 조작은 샷 종류가 없다)
 */
export const BEATS = Object.freeze({ topspin: 'cut', cut: 'normal', normal: 'topspin' });
// 리듬 재설계 v2 (설계안 §4, 수치는 scripts/sim-matchup.mjs 시뮬로 확정): 밴드는 상성과 무관(leniency 1 고정), 상성은 "선택의 품질"로만 나타난다.
//  - noise: 샷 실수 난수 배율(createShot 의 rng 로 전달 — 1 이면 기존과 비트 동일). 불리 GOOD 은 네트/아웃 ≈ 33%, PERFECT 는 0%
//  - aiSigma: 상대 탭 오차 배율. 내 타격 등급(PERFECT/GOOD)과 곱으로 쓴다 → 중립+PERFECT ≥ 유리+GOOD (타이밍 > 상성)
export const MATCHUP_FX = Object.freeze({
  win: { leniency: 1, noise: { PERFECT: 0.6, GOOD: 0.6, BAD: 1.3 }, aiSigma: { PERFECT: 1.6, GOOD: 1.25, BAD: 1.0 } },
  lose: { leniency: 1, noise: { PERFECT: 2.5, GOOD: 2.5, BAD: 2.5 }, aiSigma: { PERFECT: 1.1, GOOD: 0.9, BAD: 0.7 } },
  even: { leniency: 1, noise: { PERFECT: 1, GOOD: 1.6, BAD: 1.65 }, aiSigma: { PERFECT: 1.25, GOOD: 1, BAD: 0.8 } },
});
// 타이밍 4단계(PERFECT/GOOD/BAD/MISS) 실수 매트릭스 (scripts/sim-matchup.mjs gradeMatrix 로 확정, 간단 조작·상성 사용 시):
//   네트/아웃율  PERFECT 0% 전부 / GOOD 유리 0 · 중립 7 · 불리 33 / BAD 유리 16 · 중립 34 · 불리 60 (%) — 2026-10-08 BAD 패널티 강화(유리 8·중립 18·불리 49 에서 상향)
/** 구질별 리듬 밴드: 탑스핀=이른 타점(shift<0)·좁음, 일반=기준, 커트=늦은 타점(shift>0)·넓음. shift 는 존 반폭 단위 (폭은 SHOT_TYPES.leniency) */
export const RHYTHM_SHIFT = Object.freeze({ topspin: -0.5, normal: 0, cut: 0.5 });
export { MIN_REACTION_S } from '../core/constants.js?v=1791424546'; // 공정성 하한(설계안 §6.4)
/** 구질 위장: 상위 리그는 타구 직후 이 시간(초) 동안 공 색/종류 표시가 중립(읽기 단서 지연). 읽기 시간(타구→바운드 ≥ 0.4s) 안에 끝난다 */
export const DISGUISE_S = Object.freeze({ amateur: 0, third: 0, second: 0, first: 0.15, world: 0.2 });
/** 힌트(유리한 버튼 반짝임)를 보여주는 경기 수: 튜토리얼 + 처음 이 경기 수까지 */
export const HINT_MATCHES = 3;
const SPIN_CLASS_AT = 0.5;
/** 날아오는 공의 스핀 → 샷 종류 키 */
export const shotKeyOfSpin = (spin = 0) => (spin > SPIN_CLASS_AT ? 'topspin' : spin < -SPIN_CLASS_AT ? 'cut' : 'normal');
/** 상대 공 종류(incoming) 에 내가 mine 으로 받을 때: 'win' | 'lose' | 'even' */
export function matchupOf(mine, incoming) {
  if (!incoming || mine === incoming) return 'even';
  return BEATS[mine] === incoming ? 'win' : 'lose';
}
/** incoming 을 이기는 샷 종류 */
export const counterOf = (incoming) => Object.keys(BEATS).find((k) => BEATS[k] === incoming) ?? null;
export const MATCHUP_LABEL = Object.freeze({
  topspin: '탑스핀 공 → 일반으로 받아치면 유리!',
  cut: '커트 공 → 탑스핀으로 공격하면 유리!',
  normal: '일반 공 → 커트로 깔아 치면 유리!',
});

/** 필살기: '상성 유리 + PERFECT' 타격이 이 횟수만큼 쌓이면 다음 리턴이 필살기 (matchController.js) */
export const SPECIAL_AT = 3;
