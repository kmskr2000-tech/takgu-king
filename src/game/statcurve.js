// 스탯 성장 곡선 (수확체감). 투자한 값(raw)이 그대로 판정 폭·실수율에 곱해지면 상한이 없어서(집중 1당 판정 +6%) 상위 리그에서도 게임이 무너진다.
// 적용 스탯 = knee 까지는 1:1, 그 위로는 점점 둔해져 max 로 수렴. 장비 보정은 곡선 뒤에 더한다(장비의 가치 유지).
// 수치는 scripts/sim-balance.mjs 로 확정 (리그별 기대 승률).
export const STAT_CURVE = { knee: 4, max: 8.5, tau: 12 };

export function statCurve(raw, c = STAT_CURVE) {
  const v = Math.max(0, raw);
  return v <= c.knee ? v : c.knee + (c.max - c.knee) * (1 - Math.exp(-(v - c.knee) / c.tau));
}

/** 투자 1포인트를 더 넣었을 때 적용 스탯이 실제로 얼마나 늘어나는가(0..1): 스탯 화면의 '효율' 표시용 */
export const statEfficiency = (raw, c = STAT_CURVE) => statCurve(raw + 1, c) - statCurve(raw, c);
