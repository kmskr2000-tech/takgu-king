// 경기 화면 상대 표시: 이름 + 특징 칩(라이벌 / 플레이 스타일 / 실력대). 순수 데이터라 테스트 가능.
const STYLE = Object.freeze({
  cut: { label: '커트 위주', kind: 'cut', hint: '커트로 수비하며 기다려요 → 탑스핀으로 공격' },
  balanced: { label: '올라운더', kind: 'all', hint: '다양한 공을 섞어 쳐요 → 공 색을 보고 대응' },
});
const TIER = Object.freeze({ low: '하위권', mid: '중위권', high: '상위권' });

/** opp: season 의 상대 { name, style, tier, rival }. tutorial 이면 연습 상대 */
export function oppProfile(opp, { tutorial = false } = {}) {
  if (tutorial) return { name: opp.name, tags: [{ label: '연습 상대', kind: 'coach' }] };
  const tags = [];
  if (opp.rival) tags.push({ label: '라이벌', kind: 'rival' });
  const st = STYLE[opp.style] ?? STYLE.balanced;
  tags.push({ label: st.label, kind: st.kind });
  if (!opp.rival && TIER[opp.tier]) tags.push({ label: TIER[opp.tier], kind: `tier-${opp.tier}` });
  return { name: opp.name, tags, hint: st.hint };
}
