// 커리어 화면: 랜덤 이벤트, 월간 컵 대진표, 시즌 결산 레이더. 목업(files/media-generation-takgu-*.webp) 구성을 따른다.
import { h, svg } from './dom.js?v=1791532253';
import { radarGeometry } from '../game/review.js?v=1791532253';
import { safeReward, FAIL_LOSS } from '../game/events.js?v=1791532253';

const btn = (text, onclick, cls = '') => h('button', { class: `btn ${cls}`.trim(), onclick, type: 'button' }, text);
const pct = (p) => `${Math.round(p * 100)}%`;

/** 랜덤 이벤트: 확률형(성공 N%) vs 확정형. 확률은 숫자로 공개하고 그 숫자 그대로 굴린다 */
export function eventScreen({ event, points, onChoose }) {
  const r = event.risky; const sr = safeReward(event);
  return h('section', { class: 'screen event', 'aria-label': '커리어 이벤트' },
    h('p', { class: 'event-crumb' }, '커리어 모드 › 랜덤 이벤트'),
    h('h2', { class: 'event-title' }, event.title),
    h('p', { class: 'event-scene' }, event.scene),
    h('p', { class: 'quote event-line' }, `“${event.line}”`),
    h('div', { class: 'event-choices' },
      h('button', { class: 'event-choice risky', type: 'button', 'data-choice': 'risky', onclick: () => onChoose('risky') },
        h('b', {}, `${r.label} (성공 ${pct(r.p)})`), h('small', {}, `위험 — 성공 +${r.reward}pt / 실패 −${FAIL_LOSS}pt`), h('span', { class: 'odds' }, `🎲 ${pct(r.p)}`)),
      h('button', { class: 'event-choice safe', type: 'button', 'data-choice': 'safe', onclick: () => onChoose('safe') },
        h('b', {}, `${event.safe.label} (확정, 효과 50%)`), h('small', {}, `안정 — 확정 +${sr}pt`), h('span', { class: 'odds' }, '🛡 100%'))),
    h('p', { class: 'event-foot' }, `보유 포인트 ${points}pt · 커리어 모드는 선택이 기록됩니다`));
}

/** 이벤트 결과 */
export function eventResultScreen({ event, result, onNext }) {
  const risky = result.choice === 'risky';
  const head = !risky ? '확정 효과!' : result.success ? '대성공!' : '아쉽게 실패…';
  const text = result.delta >= 0 ? `포인트 +${result.delta}` : `포인트 ${result.delta}`;
  return h('section', { class: `screen event-result ${risky ? (result.success ? 'win' : 'lose') : 'safe'}`, 'aria-label': '이벤트 결과' },
    h('h2', {}, event.title), h('p', { class: 'event-head' }, head), h('p', { class: 'pts' }, `${text} (보유 ${result.points}pt)`), btn('계속', onNext, 'primary'));
}

/** 6각 레이더 SVG. values: [{label,value}], prev: 지난 시즌 값(없으면 null) */
export function radarChart(values, prev = null) {
  const g = radarGeometry(values, { cx: 110, cy: 110, r: 70 });
  const pg = prev ? radarGeometry(prev, { cx: 110, cy: 110, r: 70 }) : null;
  return svg('svg', { class: 'radar', viewBox: '0 0 220 220', role: 'img', 'aria-label': `능력 레이더: ${values.map((v) => `${v.label} ${Math.round(v.value * 100)}`).join(', ')}` },
    ...g.rings.map((p) => svg('polygon', { points: p, class: 'radar-ring' })),
    ...g.axes.map(([x, y]) => svg('line', { x1: 110, y1: 110, x2: x, y2: y, class: 'radar-axis' })),
    pg && svg('polygon', { points: pg.shape, class: 'radar-prev' }),
    svg('polygon', { points: g.shape, class: 'radar-shape' }),
    ...g.labels.map((l) => svg('text', { x: l.at[0], y: l.at[1], class: 'radar-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, l.label)));
}

/** 시즌 결산 패널: 레이더 + 전적 + 순위 + 지난 시즌 대비 성장 */
export function reviewPanel(review, { season = null } = {}) {
  const growth = review.prev ? review.radar.map((a, i) => ({ label: a.label, d: Math.round((a.value - review.prev[i].value) * 100) })).filter((x) => x.d !== 0) : [];
  return h('div', { class: 'review', role: 'group', 'aria-label': '시즌 결산' },
    season != null && h('p', { class: 'review-season' }, `SEASON ${season}`),
    radarChart(review.radar, review.prev),
    review.radar.some((a) => a.estimated) && h('p', { class: 'review-note' }, '※ 스피드·컨트롤·체력은 이번 시즌 경기가 적어 추정값이에요.'),
    growth.length > 0 && h('p', { class: 'review-growth' }, `지난 시즌 대비 ${growth.map((x) => `${x.label} ${x.d > 0 ? '▲' : '▼'}${Math.abs(x.d)}`).join(' · ')}`),
    h('div', { class: 'review-tiles' },
      h('div', { class: 'tile' }, h('small', {}, '시즌 기록'), h('b', {}, `${review.wins}승 ${review.losses}패`)),
      h('div', { class: 'tile' }, h('small', {}, '리그 순위'), h('b', {}, `${review.rank}위`))));
}

/** 월간 컵: 참가 신청 / 대진표 / 결과. view = cupView(state), offer = cupOffer(state) */
export function cupScreen({ view, offer, next, onStart, onJoin, onSkip, onClose, onBack }) {
  const slot = (m) => h('div', { class: `match-slot${m.mine ? ' mine' : ''}` },
    h('span', { class: m.winner && m.winner === m.a ? 'win' : '' }, m.a ?? '?'), ' vs ', h('span', { class: m.winner && m.winner === m.b ? 'win' : '' }, m.b ?? '?'), m.score ? ` (${m.score})` : '');
  return h('section', { class: 'screen cup', 'aria-label': '월간 컵' },
    h('h2', {}, view ? view.name : offer ? offer.name : '월간 컵'),
    !view && offer && h('p', {}, `8인 단판 토너먼트 — 상·하위 리그 선수도 나와요. 승리마다 +1pt, 우승 +1pt 더. 정규 시즌 순위엔 영향이 없어요. (${offer.lastWeek}주차까지 참가 가능)`),
    view && view.rounds.flatMap((r) => [h('h3', {}, r.name), ...r.matches.map(slot)]),
    view && view.done && h('p', { class: view.place === '우승' ? 'win' : '' }, `결과: ${view.place} · 획득 +${view.gained}pt`),
    view && !view.done && next && h('p', { class: 'next' }, `다음 경기: ${view.roundName} — ${next.opp.name} (${next.opp.tag})`),
    !view && offer && btn('참가하기', onJoin, 'primary'),
    !view && offer && btn('이번엔 불참', onSkip),
    view && !view.done && next && btn('경기 시작', onStart, 'primary'),
    view && view.done && btn('확인', onClose, 'primary'),
    btn('돌아가기', onBack));
}
