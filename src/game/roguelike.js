// 로그라이크 요소 ("지면 다시"): 설계서 files/탁구왕-로그라이크-설계안-정리본.md 가 정본.
//  - A 계승 보너스(영구): 시즌 종료 때 포인트를 얻어 10종 보너스에 투자한다. 수치는 작게(3~10%), 중복 구매는 중첩.
//  - B 시즌 빌드(시즌 한정): 정규 시즌 2·4·6승째 3택1 드래프트. 12종 특성, 시즌이 끝나면 소멸.
//  - 라이벌 전적 / 성장 줄기(훈련 방향 3단계 → 프로젝트): 양념. 기존 스탯 투자·훈련 모드를 그대로 쓴다.
//  모든 효과는 state.rogue 한 곳에서 파생된다. 경기·AI 난수 흐름은 건드리지 않는다(드래프트 후보는 시즌·승수로 정해지는 결정적 난수).
import { ballSpeedClass } from './controls.js?v=1792845966';

export const STAT_KEYS = Object.freeze(['power', 'spin', 'focus']);
export const DRAFT_AT = Object.freeze([2, 4, 6]); // 정규 시즌 N번째 경기를 마친 뒤 (승패 무관, 2026-10-12 설계 변경: 승수 → 경기 수)
export const DRAFT_CHOICES = 3;
export const BUILD_MAX = 3;
export const LEGACY_PTS = Object.freeze({ champion: 3, qualified: 2, other: 1 }); // 우승 / 토너먼트 진출(상위 4위) / 5위 이하 — 탈락해도 1pt

// ---- A: 계승 보너스 ----
export const LEGACY_BONUSES = Object.freeze([
  { id: 'freereroll', name: '든든한 보험', cost: 1, desc: '시즌마다 특성 다시 뽑기 1회 무료' }, // 1pt 아이템: 첫 실패 시즌(1pt)에도 살 수 있다 (게임성 리뷰 #6)
  { id: 'basics', name: '단단한 기본기', cost: 2, desc: '파워 +2', stat: { power: 2 } },
  { id: 'spinsense', name: '회전의 이해', cost: 2, desc: '스핀 +2', stat: { spin: 2 } },
  { id: 'composure', name: '침착함', cost: 2, desc: '집중 +2', stat: { focus: 2 } },
  { id: 'sponsor', name: '스폰서 계약', cost: 3, desc: '승리 포인트 +10%' },
  { id: 'rivalkiller', name: '라이벌 킬러', cost: 3, desc: '라이벌전 승리 포인트 +50%' },
  { id: 'luckyracket', name: '행운의 라켓', cost: 3, desc: '이벤트 성공률 +5%' },
  { id: 'sharpeye', name: '예리한 눈', cost: 4, desc: '타이밍 윈도우 +4%' },
  { id: 'firstball', name: '첫 공의 달인', cost: 4, desc: '첫 3구 위력 +5%' },
  { id: 'strongheart', name: '강심장', cost: 5, desc: '듀스 타이밍 윈도우 +8%' },
  { id: 'comeback', name: '역전의 명수', cost: 5, desc: '매치포인트 위기 파워 +6%' },
]);
/** 드래프트 리롤 (스탯 포인트 싱크, 게임성 리뷰 #5): 한 드래프트에서 2→3→4pt(상한 4). 「든든한 보험」은 시즌마다 개당 1회 무료 */
export const REROLL_COSTS = Object.freeze([2, 3, 4]);
export function rerollCost(state) {
  const r = ensureRogue(state); if (!r.draft) return null;
  const freeLeft = (r.owned.freereroll ?? 0) - (r.freeUsed ?? 0);
  return freeLeft > 0 ? 0 : REROLL_COSTS[Math.min(r.draft.rerolls ?? 0, REROLL_COSTS.length - 1)];
}
export function rerollDraft(state) {
  const r = ensureRogue(state); const cost = rerollCost(state);
  if (cost == null) throw new Error('열린 드래프트가 없음');
  if (state.statPoints < cost) return false;
  if (cost === 0) r.freeUsed = (r.freeUsed ?? 0) + 1;
  state.statPoints -= cost;
  const n = (r.draft.rerolls ?? 0) + 1;
  const prev = new Set(r.draft.options);
  const salt = (r.draft.matches ?? 50) + 1000 * n;
  let options = draftOptions(state, salt);
  if (options.every((id) => prev.has(id))) options = draftOptions(state, salt + 17); // 거의 같은 후보가 또 나오면 한 번 더 굴림
  r.draft = { ...r.draft, options, rerolls: n };
  return true;
}
export const bonusOf = (id) => LEGACY_BONUSES.find((b) => b.id === id) ?? null;

// ---- B: 시즌 특성 (수치는 밸런싱 단계에서 조정 — 시즌 한정이라 과감하게) ----
export const TRAIT_STYLES = Object.freeze({ attack: '공격형', defense: '수비형', trick: '변칙형', ops: '운영형' });
export const TRAITS = Object.freeze([
  { id: 'heavydrive', style: 'attack', icon: '🔥', name: '헤비 드라이브', desc: '탑스핀 위력 +15% / 커트 위력 -10%' },
  { id: 'smashchance', style: 'attack', icon: '💥', name: '스매시 찬스', desc: '느린 공(찬스볼) 파워 +20%' },
  { id: 'quickattack', style: 'attack', icon: '⚡', name: '속공 전개', desc: '탑스핀(빠른 공격) 성공률 +10%' },
  { id: 'ironcut', style: 'defense', icon: '🛡', name: '철벽 커트', desc: '커트 성공률 +15%' },
  { id: 'persistent', style: 'defense', icon: '🌀', name: '끈질긴 랠리', desc: '8구 이상 랠리 중 집중 +2' },
  { id: 'courseread', style: 'defense', icon: '👁', name: '코스 읽기', desc: '상대가 닿기 어려운 코스를 코트에 표시' },
  { id: 'servemagic', style: 'trick', icon: '🎩', name: '서브 마술사', desc: '내 서브 뒤 상대 첫 리턴이 어려워짐' },
  { id: 'gambler', style: 'trick', icon: '🎲', name: '도박사', desc: '강타 위력 +30% · 상대 리턴 어려움 / 타이밍이 PERFECT 가 아니면 실수 ×1.3' },
  { id: 'variation', style: 'trick', icon: '🌪', name: '변화구', desc: '상성 유리 구질로 받을 때 실수 -10%' },
  { id: 'pointhunter', style: 'ops', icon: '🎯', name: '포인트 헌터', desc: '듀스·매치포인트 구간 집중 +3' },
  { id: 'moodmaker', style: 'ops', icon: '🎶', name: '분위기 메이커', desc: '연승 중 타이밍 윈도우 +1.5%/승 (최대 5승)' },
  { id: 'stamina', style: 'ops', icon: '🫁', name: '체력 배분', desc: '경기 후반(8점 이상) 실수율 -15%' },
]);
export const traitOf = (id) => TRAITS.find((t) => t.id === id) ?? null;

// ---- 성장 줄기 라이트 ----
export const GROWTH_STAGES = 3;
export const GROWTH_UNITS_PER_STAGE = 2; // 스탯 투자 또는 훈련 승리 1회 = 1칸, 2칸 = 1단계
export const GROWTH_PROJECTS = Object.freeze({
  power: { name: '강타 프로젝트', desc: '파워 +1', stat: { power: 1 } },
  spin: { name: '회전 마스터 프로젝트', desc: '스핀 +1', stat: { spin: 1 } },
  focus: { name: '평정심 프로젝트', desc: '집중 +1', stat: { focus: 1 } },
});

// ---- 상태 ----
export function emptyRogue() {
  return {
    points: 0, owned: {}, build: [], draftedAt: [], draft: null, queued: 0, queuedAt: [], cupTrophies: 0, freeUsed: 0,
    rival: {}, growth: { power: 0, spin: 0, focus: 0 }, growthDir: 'power', carry: 0, lastLegacy: null,
  };
}

/** 저장 보강 (예전 저장에는 없다) */
export function ensureRogue(state) {
  const r = state.rogue;
  if (!r || typeof r !== 'object' || Array.isArray(r)) { state.rogue = emptyRogue(); return state.rogue; }
  const base = emptyRogue();
  if (!Number.isFinite(r.points) || r.points < 0) r.points = 0;
  if (!r.owned || typeof r.owned !== 'object' || Array.isArray(r.owned)) r.owned = {};
  for (const k of Object.keys(r.owned)) if (!bonusOf(k) || !(r.owned[k] > 0)) delete r.owned[k];
  if (!Array.isArray(r.build)) r.build = [];
  r.build = r.build.filter((id) => traitOf(id)).slice(-BUILD_MAX);
  if (!Array.isArray(r.draftedAt)) r.draftedAt = [];
  if (!Array.isArray(r.queuedAt)) r.queuedAt = [];
  if (!Number.isFinite(r.freeUsed) || r.freeUsed < 0) r.freeUsed = 0;
  if (!Number.isFinite(r.cupTrophies) || r.cupTrophies < 0) r.cupTrophies = 0;
  if (!Number.isFinite(r.queued) || r.queued < 0) r.queued = r.queuedAt.length;
  if (r.draft && !(Array.isArray(r.draft.options) && r.draft.options.every((id) => traitOf(id)))) r.draft = null;
  if (r.draft === undefined) r.draft = null;
  if (!r.rival || typeof r.rival !== 'object' || Array.isArray(r.rival)) r.rival = {};
  if (!r.growth || typeof r.growth !== 'object') r.growth = base.growth;
  for (const k of STAT_KEYS) if (!Number.isFinite(r.growth[k]) || r.growth[k] < 0) r.growth[k] = 0;
  if (!STAT_KEYS.includes(r.growthDir)) r.growthDir = 'power';
  if (!Number.isFinite(r.carry) || r.carry < 0) r.carry = 0;
  if (r.lastLegacy === undefined) r.lastLegacy = null;
  return r;
}

const count = (state, id) => ensureRogue(state).owned[id] ?? 0;
export const hasTrait = (state, id) => ensureRogue(state).build.includes(id);

// ---- A: 구매 ----
export function buyBonus(state, id) {
  const r = ensureRogue(state); const b = bonusOf(id);
  if (!b) throw new Error(`알 수 없는 보너스: ${id}`);
  if (r.points < b.cost) return false;
  r.points -= b.cost; r.owned[id] = (r.owned[id] ?? 0) + 1;
  return true;
}

/** 시즌 종료 포인트: 우승 3 / 토너먼트 진출(상위 4위) 2 / 그 밖 1 — 탈락해도 1pt */
export const legacyPointsFor = ({ champion, rank }) => (champion ? LEGACY_PTS.champion : rank <= 4 ? LEGACY_PTS.qualified : LEGACY_PTS.other);

/** 시즌 종료 처리: 포인트 지급 + 빌드 소멸. 반환 요약(결산 화면용) */
export function settleSeason(state, { champion, rank }) {
  const r = ensureRogue(state);
  const gained = legacyPointsFor({ champion, rank });
  const lostBuild = r.build.slice();
  r.points += gained; r.build = []; r.draft = null; r.draftedAt = []; r.queued = 0; r.queuedAt = []; r.freeUsed = 0;
  r.lastLegacy = { gained, lostBuild };
  return { gained, total: r.points, lostBuild };
}

/** 새 시즌 시작: 빌드·드래프트 기록 초기화 (이미 settleSeason 으로 비워졌더라도 안전) */
export function resetSeasonBuild(state) {
  const r = ensureRogue(state); r.build = []; r.draft = null; r.draftedAt = []; r.queued = 0; r.queuedAt = []; r.freeUsed = 0;
}

// ---- 스탯 합산: 투자 스탯(raw)에 더해진 뒤 statCurve 를 통과한다 (season.js effectiveStats) ----
export function statBonus(state) {
  const r = ensureRogue(state); const out = { power: 0, spin: 0, focus: 0 };
  for (const b of LEGACY_BONUSES) if (b.stat) for (const k of STAT_KEYS) out[k] += (b.stat[k] ?? 0) * (r.owned[b.id] ?? 0);
  for (const k of STAT_KEYS) if (growthStage(state, k) >= GROWTH_STAGES) out[k] += GROWTH_PROJECTS[k].stat[k];
  return out;
}

// ---- 포인트 보너스 (스폰서 계약 · 라이벌 킬러) ----
// 정수 포인트에 퍼센트를 곱하면 소수가 나오므로, 소수점 이하는 carry 에 쌓였다가 1이 되면 지급한다 (한 경기 단위로는 안 보여도 누적하면 정확히 반영)
export function awardBonusPoints(state, base, { won, rival = false }) {
  const r = ensureRogue(state);
  if (!won) return { total: base, bonus: 0 };
  const pct = 0.1 * count(state, 'sponsor') + (rival ? 0.5 * count(state, 'rivalkiller') : 0);
  const acc = r.carry + base * pct;
  const whole = Math.floor(acc + 1e-9);
  r.carry = Math.max(0, Math.round((acc - whole) * 1e6) / 1e6);
  return { total: base + whole, bonus: whole };
}

// ---- 이벤트 성공률 ----
export const eventLuck = (state) => 0.05 * count(state, 'luckyracket');

// ---- B: 드래프트 ----
/** 후보를 정하는 결정적 난수(mulberry32): 시즌·회차·승수로 고정 — 경기·AI 난수와 분리 */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function draftOptions(state, salt) {
  const r = ensureRogue(state);
  const rnd = seeded(Math.imul(state.season * 7919 + (state.cycle ?? 1) * 104729 + salt * 15485863, 2654435761) ^ 0x9e3779b1);
  const pool = TRAITS.filter((t) => !r.build.includes(t.id)).map((t) => t.id);
  const out = [];
  while (out.length < DRAFT_CHOICES && pool.length) out.push(...pool.splice(Math.floor(rnd() * pool.length), 1));
  // 3장이 전부 같은 계열이면 마지막 장을 다른 계열 하나로 바꾼다 — 계열을 고를 선택지를 보장 (게임성 리뷰 #7)
  if (out.length === DRAFT_CHOICES && out.every((id) => traitOf(id).style === traitOf(out[0]).style)) {
    const other = pool.filter((id) => traitOf(id).style !== traitOf(out[0]).style);
    if (other.length) out[DRAFT_CHOICES - 1] = other[Math.floor(rnd() * other.length)];
  }
  return out;
}

/** 정규 경기 하나를 마친 직후 호출(승패 무관): matches 번째 경기가 2·4·6이면 드래프트를 연다. 반환: 새로 열렸으면 true */
export function checkDraft(state, matches) {
  const r = ensureRogue(state);
  if (state.phase !== 'regular') return false;
  if (!DRAFT_AT.includes(matches) || r.draftedAt.includes(matches)) return false;
  r.draftedAt.push(matches);
  if (r.draft) { r.queued = (r.queued ?? 0) + 1; r.queuedAt = [...(r.queuedAt ?? []), matches]; return false; } // 아직 안 고른 드래프트가 있으면 순서를 기다린다 (고르면 다음 것이 열림)
  r.draft = { options: draftOptions(state, matches), source: 'matches', matches };
  return true;
}

/** 재도전 시즌(같은 리그를 다시 하는 시즌): 1주차 경기 전에 드래프트 1회 선지급 — 시즌 최대 3회와 별개의 보너스. 이미 열려 있으면 열지 않는다 */
export function openRetryDraft(state) {
  const r = ensureRogue(state);
  if (r.draft) return false;
  r.draft = { options: draftOptions(state, 50), source: 'retry', matches: 0 };
  return true;
}

/** 이벤트 보상 등 다른 획득처: 드래프트가 이미 열려 있으면 열지 않는다 */
export function openEventDraft(state) {
  const r = ensureRogue(state);
  if (r.draft) return false;
  r.draft = { options: draftOptions(state, 100 + (state.week ?? 0)), source: 'event', matches: null };
  return true;
}

export const pendingDraft = (state) => ensureRogue(state).draft;

/** 3택1. 빌드가 가득(3개)이면 가장 오래된 특성을 대신한다 */
export function pickDraft(state, id) {
  const r = ensureRogue(state);
  if (!r.draft || !r.draft.options.includes(id)) throw new Error('고를 수 없는 특성');
  r.build.push(id);
  const dropped = r.build.length > BUILD_MAX ? r.build.shift() : null;
  r.draft = null;
  if (r.queued > 0) { const m = r.queuedAt.shift(); r.queued -= 1; r.draft = { options: draftOptions(state, m), source: 'matches', matches: m }; }
  return { picked: id, dropped };
}

/** 다음 드래프트까지 남은 경기 수 (없으면 null) — 리그 화면의 게이지용 */
export function draftGauge(state) {
  const r = ensureRogue(state);
  const played = state.phase === 'regular' ? Math.max(0, (state.week ?? 1) - 1) : 9; // 이번 시즌에 마친 정규 경기 수
  const next = DRAFT_AT.find((n) => n > played && !r.draftedAt.includes(n)) ?? null;
  return { played, next, need: next == null ? null : next - played, done: DRAFT_AT.filter((n) => r.draftedAt.includes(n)).length, total: DRAFT_AT.length };
}

// ---- 라이벌 전적 ----
export function recordRival(state, won) {
  const r = ensureRogue(state);
  const rec = (r.rival[state.league] ??= { w: 0, l: 0 });
  if (won) rec.w += 1; else rec.l += 1;
  return rec;
}
export const rivalRecord = (state, league = state.league) => {
  const rec = ensureRogue(state).rival[league];
  return { w: rec?.w ?? 0, l: rec?.l ?? 0 };
};
export const rivalRecordText = (state, league = state.league) => {
  const { w, l } = rivalRecord(state, league);
  return w + l === 0 ? '첫 대결' : `맞대결 ${w}승 ${l}패`;
};

// ---- 성장 줄기 라이트 ----
export const growthStage = (state, key) => Math.min(GROWTH_STAGES, Math.floor(ensureRogue(state).growth[key] / GROWTH_UNITS_PER_STAGE));
export function addGrowth(state, key, units = 1) {
  const r = ensureRogue(state);
  if (!STAT_KEYS.includes(key)) throw new Error(`알 수 없는 방향: ${key}`);
  const before = growthStage(state, key);
  r.growth[key] = Math.min(GROWTH_STAGES * GROWTH_UNITS_PER_STAGE, r.growth[key] + units);
  const after = growthStage(state, key);
  return { stage: after, unlocked: before < GROWTH_STAGES && after >= GROWTH_STAGES ? GROWTH_PROJECTS[key] : null };
}
export function setGrowthDir(state, key) {
  if (!STAT_KEYS.includes(key)) throw new Error(`알 수 없는 방향: ${key}`);
  ensureRogue(state).growthDir = key;
}
/** 경기 승패 기록의 연승(정규+토너먼트, 내 경기만) */
export function winStreak(state) {
  let n = 0;
  for (let i = (state.log?.length ?? 0) - 1; i >= 0; i--) {
    const g = state.log[i];
    if (g.a !== 0 && g.b !== 0) continue;
    if (g.winner === 0) n += 1; else break;
  }
  return n;
}

// ---- 경기 mods ----
/** 경기 컨트롤러에 넘길 효과 묶음 (순수 데이터). 없으면 null 대신 빈 mods 가 아니라 그대로 쓰지 않는 쪽을 권장 */
export function modsFor(state) {
  const r = ensureRogue(state);
  const n = (id) => r.owned[id] ?? 0;
  const t = new Set(r.build);
  const streak = t.has('moodmaker') ? Math.min(5, winStreak(state)) : 0;
  const setStep = Object.fromEntries(Object.keys(TRAIT_STYLES).map((st) => [st, Math.max(0, r.build.filter((id) => traitOf(id)?.style === st).length - 1)]));
  const m = {
    traits: [...t],
    leniency: (1 + 0.04 * n('sharpeye') + 0.015 * streak) * (1 + SET_FX.ops.leniency * setStep.ops), // 예리한 눈 · 분위기 메이커
    deuceLeniency: 1 + 0.08 * n('strongheart'),
    firstPower: 1 + 0.05 * n('firstball'), firstShots: 3, firstSigma: 1 + FX_SIGMA.firstball * n('firstball'), // 첫 공의 달인: 위력 +5% 에 더해 상대가 첫 3구를 받기 어렵다(탭 오차)
    crisisPower: 1 + 0.06 * n('comeback'), crisisSigma: 1 + FX_SIGMA.comeback * n('comeback'), // 역전의 명수: 위기 때 위력 +6%, 상대가 흔들린다
    serveSigma: t.has('servemagic') ? 1.3 : 1,
    strikeSigma: (t.has('gambler') ? TRAIT_FX.gambler.aiSigma : 1) * (1 + SET_FX.attack.strike * setStep.attack), // 도박사 + 공격 세트: 강타를 받는 AI 의 탭 오차 (커트는 강타가 아님)
    topSigma: t.has('heavydrive') ? TRAIT_FX.heavydrive.aiSigma : 1,
    setNoise: 1 - SET_FX.defense.noise * setStep.defense, setSigma: 1 + SET_FX.trick.sigma * setStep.trick,
    setSteps: setStep,
  };
  const active = m.setNoise !== 1 || m.setSigma !== 1 || m.leniency !== 1 || m.deuceLeniency !== 1 || m.firstPower !== 1 || m.crisisPower !== 1 || m.firstSigma !== 1 || m.crisisSigma !== 1 || m.traits.length > 0;
  return active ? m : null;
}

const MODS_NONE = Object.freeze({ traits: [], leniency: 1, deuceLeniency: 1, firstPower: 1, firstShots: 3, firstSigma: 1, crisisPower: 1, crisisSigma: 1, serveSigma: 1, strikeSigma: 1, topSigma: 1, setNoise: 1, setSigma: 1, setSteps: {} });
export const normalizeMods = (m) => m ?? MODS_NONE;

/** 계승 보너스 중 '위력 %' 만으로는 효과가 측정되지 않던 두 개(시뮬 0%p)를 상대 탭 오차로도 표현 (게임성 리뷰 #6) — 개당 가산 */
export const FX_SIGMA = { firstball: 0.12, comeback: 0.15 };

/** 특성 수치 (밸런싱 대상 — scripts/sim-roguelike.mjs 로 확인). 시즌 한정이라 A 보다 과감하게 */
/** 계열 세트 보너스 (게임성 리뷰 #7, 설계안 "계열별 시너지"): 같은 계열 2개면 1단, 3개면 2단. 단계당 수치 */
export const SET_FX = { attack: { strike: 0.08 }, defense: { noise: 0.06 }, trick: { sigma: 0.05 }, ops: { leniency: 0.02 } };
export const TRAIT_FX = {
  // 헤비 드라이브: 탑스핀 위력만으로는 powerCap 을 넘어 효과가 0 이었다(시뮬) → 상대가 받기 어려운 탑스핀(aiSigma)으로도 표현
  heavydrive: { top: 1.15, cut: 0.9, aiSigma: 1.12 }, smashchance: { power: 1.2 }, quickattack: { noise: 0.9 }, ironcut: { noise: 0.85 },
  // 도박사: noise 는 PERFECT 가 아닐 때만 (정확히 맞추면 안전한 강타, 어설프면 크게 흔들림). aiSigma = 강타를 받는 AI 의 탭 오차 배율
  gambler: { power: 1.3, noise: 1.3, aiSigma: 1.7 }, variation: { win: 0.9, lose: 1.0 }, stamina: { noise: 0.85 },
};

/** 점수 상황: deuce(10:10 이상 동점권) / crisis(상대가 한 점이면 끝) / late(경기 후반) */
export function scoreCtx(score) {
  const hi = Math.max(score.me, score.opp);
  return {
    deuce: score.me >= 10 && score.opp >= 10,
    crisis: score.opp >= 10 && score.opp > score.me,
    late: hi >= 8,
    point: hi >= 10, // 듀스·매치포인트 구간
  };
}

/** 타이밍 윈도우 배율 */
export function leniencyMul(m, score) {
  return m.leniency * (scoreCtx(score).deuce ? m.deuceLeniency : 1);
}

/** 집중 보너스 (끈질긴 랠리 · 포인트 헌터) */
export function focusAdd(m, { score, rallyShots = 0 }) {
  let add = 0;
  if (m.traits.includes('persistent') && rallyShots >= 8) add += 2;
  if (m.traits.includes('pointhunter') && scoreCtx(score).point) add += 3;
  return add;
}

/**
 * 샷 보정: { powerMul, noiseMul }.
 *  type: 'normal'|'topspin'|'cut', matchup: 'win'|'lose'|'even', incomingSpeed: 바운드 후 속도(없으면 서브/첫 공),
 *  ballIndex: 이 랠리에서 이번 샷이 몇 번째 공인가 (서브 = 1), score: 현재 점수, grade: 타이밍 등급(서브는 null)
 */
export function shotAdjust(m, { type, matchup = 'even', incomingSpeed = null, ballIndex = 9, score, grade = null }) {
  const t = m.traits; const c = scoreCtx(score);
  let powerMul = 1; let noiseMul = 1;
  const fx = TRAIT_FX;
  if (t.includes('heavydrive')) powerMul *= type === 'topspin' ? fx.heavydrive.top : type === 'cut' ? fx.heavydrive.cut : 1;
  if (t.includes('smashchance') && incomingSpeed != null && ballSpeedClass(incomingSpeed) === 'slow') powerMul *= fx.smashchance.power;
  if (t.includes('gambler')) { powerMul *= fx.gambler.power; if (grade !== 'PERFECT') noiseMul *= fx.gambler.noise; }
  if (t.includes('quickattack') && type === 'topspin') noiseMul *= fx.quickattack.noise;
  if (t.includes('ironcut') && type === 'cut') noiseMul *= fx.ironcut.noise;
  if (t.includes('stamina') && c.late) noiseMul *= fx.stamina.noise;
  if (t.includes('variation')) noiseMul *= matchup === 'win' ? fx.variation.win : matchup === 'lose' ? fx.variation.lose : 1;
  noiseMul *= m.setNoise; // 수비 세트
  if (ballIndex <= m.firstShots) powerMul *= m.firstPower; // 첫 3구: 각 랠리의 서브(1구)·리턴(2구)·3구 공격
  if (c.crisis) powerMul *= m.crisisPower;
  return { powerMul, noiseMul };
}
