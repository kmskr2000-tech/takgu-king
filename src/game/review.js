// 시즌 결산 + 6각 능력 레이더. 순수 데이터 — 물리·판정·AI·밸런스는 건드리지 않는다.
//  - 파워·스핀·정신: 실제 스탯(effectiveStats = 곡선+장비). 게임에 새 스탯을 만들지 않는다.
//  - 스피드·컨트롤·체력: 그 시즌에 치른 경기 집계(경기 요약 summary)에서 파생. 표본이 모자라면 '추정'(중립값)으로 표시.
//    스피드 = 공을 놓치지 않는 반응(1 − 1.5×MISS율), 컨트롤 = PERFECT율 ÷ 0.5, 체력 = 경기당 최장 랠리 평균 ÷ 15.
//  축 순서는 목업과 같다: 위에서 시계 방향 스피드·파워·컨트롤·스핀·체력·정신.
export const RADAR_AXES = Object.freeze([
  { id: 'speed', label: '스피드' }, { id: 'power', label: '파워' }, { id: 'control', label: '컨트롤' },
  { id: 'spin', label: '스핀' }, { id: 'stamina', label: '체력' }, { id: 'mind', label: '정신' },
]);
export const STAT_AXIS_MAX = 10; // 파워·스핀·정신 만점 기준 (적용 스탯 곡선 상한 8.5 + 장비)
export const MIN_TALLY_TAPS = 20; // 파생 축을 믿을 최소 타수
export const NEUTRAL = 0.3; // 표본 부족 시 표시값
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const r2 = (v) => Math.round(v * 100) / 100;

export const emptyTally = () => ({ matches: 0, taps: 0, perfect: 0, miss: 0, rallySum: 0 });

/** 경기 요약(tally.summary())을 시즌 집계에 더한다. 튜토리얼·훈련·멀티는 부르지 않는다 */
export function addMatchToTally(state, summary) {
  if (!summary) return state.seasonTally;
  const t = ensureTally(state);
  t.matches += 1; t.taps += summary.taps ?? 0; t.perfect += summary.perfect ?? 0; t.miss += summary.miss ?? 0; t.rallySum += summary.longestRally ?? 0;
  return t;
}

/** 저장 보강: 예전 저장에는 집계가 없다 */
export function ensureTally(state) {
  const t = state.seasonTally;
  const ok = t && typeof t === 'object' && ['matches', 'taps', 'perfect', 'miss', 'rallySum'].every((k) => Number.isFinite(t[k]) && t[k] >= 0);
  if (!ok) state.seasonTally = emptyTally();
  return state.seasonTally;
}

/** 레이더 값: [{id,label,value(0..1),estimated}] — eff 는 effectiveStats(state) */
export function radarValues(tally, eff) {
  const t = tally ?? emptyTally();
  const enough = t.taps >= MIN_TALLY_TAPS && t.matches > 0;
  const derived = {
    speed: enough ? clamp01(1 - 1.5 * (t.miss / t.taps)) : NEUTRAL,
    control: enough ? clamp01((t.perfect / t.taps) / 0.5) : NEUTRAL,
    stamina: enough ? clamp01((t.rallySum / t.matches) / 15) : NEUTRAL,
  };
  const val = {
    ...derived,
    power: clamp01(eff.power / STAT_AXIS_MAX), spin: clamp01(eff.spin / STAT_AXIS_MAX), mind: clamp01(eff.focus / STAT_AXIS_MAX),
  };
  return RADAR_AXES.map((a) => ({ id: a.id, label: a.label, value: r2(val[a.id]), estimated: !enough && a.id in derived }));
}

/** 레이더 도형 좌표 (SVG 용 순수 계산). 반지름 r, 중심 (cx, cy), 위쪽부터 시계 방향 */
export function radarGeometry(values, { cx = 100, cy = 100, r = 70 } = {}) {
  const n = values.length;
  const at = (i, k) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [r2(cx + Math.cos(a) * r * k), r2(cy + Math.sin(a) * r * k)]; };
  const pts = (k) => values.map((_, i) => at(i, typeof k === 'function' ? k(i) : k).join(',')).join(' ');
  return {
    rings: [0.25, 0.5, 0.75, 1].map((k) => pts(k)),
    axes: values.map((_, i) => at(i, 1)),
    shape: pts((i) => values[i].value),
    labels: values.map((v, i) => ({ label: v.label, at: at(i, 1.3) })),
  };
}

/** 시즌 종료 요약에 붙일 결산: 레이더(이번/지난 시즌), 전적, 순위 */
export function buildReview(state, { rank, wins, losses }, eff) {
  const radar = radarValues(ensureTally(state), eff);
  const prev = Array.isArray(state.radarPrev) && state.radarPrev.length === RADAR_AXES.length ? state.radarPrev : null;
  state.radarPrev = radar.map((a) => ({ id: a.id, label: a.label, value: a.value, estimated: a.estimated }));
  return { radar, prev, wins, losses, rank };
}
