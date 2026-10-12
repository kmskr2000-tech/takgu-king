// 커리어 화면: 랜덤 이벤트, 월간 컵 대진표, 시즌 결산 레이더. 목업(files/media-generation-takgu-*.webp) 구성을 따른다.
import { h, svg } from './dom.js?v=1791793229';
import { radarGeometry } from '../game/review.js?v=1791793229';
import { safeReward, FAIL_LOSS } from '../game/events.js?v=1791793229';
import { TRAIT_STYLES, LEGACY_BONUSES, BUILD_MAX, traitOf, DRAFT_AT, GROWTH_STAGES, GROWTH_PROJECTS, STAT_KEYS, growthStage, draftGauge, ensureRogue } from '../game/roguelike.js?v=1791793229';

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
    h('h2', {}, event.title), h('p', { class: 'event-head' }, head), h('p', { class: 'pts' }, `${text} (보유 ${result.points}pt)`), result.draft && h('p', { class: 'win' }, '🃏 시즌 특성 드래프트 획득! 다음 화면에서 한 장 골라요'), btn('계속', onNext, 'primary'));
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
    view && view.done && h('p', { class: view.place === '우승' ? 'win' : '' }, `결과: ${view.place} · 획득 +${view.gained}pt${view.place === '우승' ? ' · 컵 트로피 획득!' : ''}`),
    view && !view.done && next && h('p', { class: 'next' }, `다음 경기: ${view.roundName} — ${next.opp.name} (${next.opp.tag})`),
    !view && offer && btn('참가하기', onJoin, 'primary'),
    !view && offer && btn('이번엔 불참', onSkip),
    view && !view.done && next && btn('경기 시작', onStart, 'primary'),
    view && view.done && btn('확인', onClose, 'primary'),
    btn('돌아가기', onBack));
}

// ---- 로그라이크 (roguelike.js, 설계서 files/탁구왕-로그라이크-설계안-정리본.md) ----

const STAT_LABEL = { power: '파워', spin: '스핀', focus: '집중' };

/** 특성 3택1 카드. source: 'wins'(리그 승리) | 'event' */
export function draftScreen({ draft, build, onPick, onReroll = null, rerollCost = null, points = 0 }) {
  const cards = draft.options.map((id) => {
    const t = traitOf(id);
    return h('button', { class: `draft-card ${t.style}`, type: 'button', 'data-trait': t.id, onclick: () => onPick(t.id) },
      h('span', { class: 'dc-icon', 'aria-hidden': 'true' }, t.icon), h('small', {}, TRAIT_STYLES[t.style]), h('b', {}, t.name), h('span', { class: 'dc-desc' }, t.desc));
  });
  const full = build.length >= BUILD_MAX;
  return h('section', { class: 'screen draft', 'aria-label': '특성 드래프트' },
    h('p', { class: 'event-crumb' }, draft.source === 'event' ? '이벤트 보상' : draft.source === 'retry' ? '재도전 보너스 — 지면 다시!' : `리그 ${draft.matches}경기를 마쳤어요`),
    h('h2', {}, '특성 드래프트'),
    h('p', {}, '이번 시즌 동안만 쓰는 특성이에요. 한 장 고르면 다음 경기부터 적용!'),
    h('div', { class: 'draft-cards' }, ...cards),
    onReroll && rerollCost != null && h('button', { class: 'btn draft-reroll', type: 'button', disabled: points < rerollCost ? true : null, onclick: onReroll }, rerollCost === 0 ? '🔄 다시 뽑기 (무료)' : `🔄 다시 뽑기 (${rerollCost}pt · 보유 ${points}pt)`),
    full && h('p', { class: 'draft-note' }, `빌드가 가득 찼어요 — 새로 고르면 가장 오래된 특성「${traitOf(build[0]).name}」이 빠져요.`),
    build.length > 0 && h('p', { class: 'draft-build' }, `현재 빌드: ${build.map((id) => `${traitOf(id).icon} ${traitOf(id).name}`).join(' · ')}`));
}

/** 특성 고른 뒤 확인 */
export function draftPickedScreen({ picked, dropped, onNext }) {
  const t = traitOf(picked);
  return h('section', { class: 'screen draft-picked' },
    h('h2', {}, `${t.icon} ${t.name}`), h('p', {}, t.desc), dropped && h('p', { class: 'draft-note' }, `「${traitOf(dropped).name}」은 빠졌어요.`),
    h('p', { class: 'quote' }, '“지면 다시.” 이번 시즌은 이 빌드로 간다!'), btn('계속', onNext, 'primary'));
}

/** 리그 화면 빌드 줄: 현재 특성 아이콘(최대 3칸) + 다음 드래프트까지 게이지 */
export function buildStrip(state) {
  const r = ensureRogue(state); const g = draftGauge(state);
  const slots = Array.from({ length: BUILD_MAX }, (_, i) => {
    const t = traitOf(r.build[i]);
    return h('span', { class: `build-slot${t ? ' on' : ''}`, title: t ? `${t.name}: ${t.desc}` : '빈 칸', 'data-trait': t?.id ?? '' }, t ? t.icon : '·');
  });
  const gauge = g.next == null ? '이번 시즌 드래프트 완료' : g.need === 1 ? '1경기 더 하면 드래프트!' : `${g.need}경기 더 하면 드래프트`;
  return h('div', { class: 'build-strip', 'aria-label': '시즌 빌드' },
    h('span', { class: 'build-slots' }, ...slots),
    h('span', { class: 'build-gauge' },
      h('small', {}, `${g.played}경기 · ${gauge}`),
      h('i', { class: 'gauge-bar', 'aria-hidden': 'true' }, ...DRAFT_AT.map((n) => h('b', { class: g.played >= n || r.draftedAt.includes(n) ? 'on' : '' }, String(n))))));
}

/** 시즌 결산: 계승 포인트 + 사라지는 빌드 + 투자 상점 (A/B 연결) */
export function legacyPanel({ legacy, state, onBuy }) {
  const r = ensureRogue(state);
  const items = LEGACY_BONUSES.map((b) => {
    const n = r.owned[b.id] ?? 0; const can = r.points >= b.cost;
    return h('button', { class: `legacy-item${can ? ' can' : ''}`, type: 'button', 'data-bonus': b.id, disabled: can ? null : true, onclick: () => onBuy(b.id) },
      h('b', {}, `${b.name}${n ? ` ×${n}` : ''}`), h('span', {}, b.desc), h('em', {}, `${b.cost}pt`));
  });
  return h('div', { class: 'legacy', role: 'group', 'aria-label': '계승 보너스' },
    legacy && h('p', { class: 'legacy-got' }, `계승 포인트 +${legacy.gained}pt 획득${legacy.gained === 1 ? ' — 탈락해도 성장은 남아요' : ''}`),
    legacy && legacy.lostBuild.length > 0 && h('p', { class: 'legacy-lost' }, `시즌 빌드 소멸: ${legacy.lostBuild.map((id) => `${traitOf(id).icon} ${traitOf(id).name}`).join(' · ')}`),
    h('h3', {}, '계승 보너스 (영구)'),
    h('p', { class: 'legacy-pts' }, `보유 ${r.points}pt`),
    h('div', { class: 'legacy-list' }, ...items));
}

/** 성장 줄기: 방향별 3단계 + 프로젝트 해금 */
export function growthPanel(state, { onDir = null } = {}) {
  const r = ensureRogue(state);
  const rows = STAT_KEYS.map((k) => {
    const st = growthStage(state, k); const p = GROWTH_PROJECTS[k]; const done = st >= GROWTH_STAGES;
    const pips = Array.from({ length: GROWTH_STAGES }, (_, i) => h('i', { class: i < st ? 'on' : '' }, i < st ? '▰' : '▱'));
    return h('div', { class: `growth-row${done ? ' done' : ''}${onDir && r.growthDir === k ? ' sel' : ''}`, 'data-dir': k },
      onDir ? h('button', { class: `btn growth-pick${r.growthDir === k ? ' primary' : ''}`, type: 'button', onclick: () => onDir(k) }, STAT_LABEL[k]) : h('b', {}, STAT_LABEL[k]),
      h('span', { class: 'pips' }, ...pips, ` ${st}/${GROWTH_STAGES}`),
      h('small', {}, done ? `「${p.name}」 해금 — ${p.desc}` : `3/3 → 「${p.name}」`));
  });
  return h('div', { class: 'growth', role: 'group', 'aria-label': '성장 줄기' }, h('h3', {}, '성장 줄기'), ...rows);
}
