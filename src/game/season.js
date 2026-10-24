import { LEAGUES, TIER_LAYOUT, makeAiParams, simulateQuick, RIVAL_CYCLE } from '../core/index.js?v=1792845630';
import { RIVAL_STORY, ensureStory, rivalStory } from './story.js?v=1792845630';
import { statCurve } from './statcurve.js?v=1792845630';
import { ensureTally, emptyTally, buildReview } from './review.js?v=1792845630';
import { ensureEvents } from './events.js?v=1792845630';
import { ensurePerks, grantPerks, registerUnlocks, CHAMPION_PERKS } from './perks.js?v=1792845630';
import { ensureRogue, emptyRogue, statBonus, awardBonusPoints, checkDraft, openRetryDraft, recordRival, settleSeason, resetSeasonBuild } from './roguelike.js?v=1792845630';

export const SAVE_VERSION = 2;
export const WIN_PT = 3;
export const LOSE_PT = 1;
// 승급은 영구, 강등 없음 (로그라이크 설계 §4): 5위 이하·토너먼트 미우승이면 같은 리그에서 다시 — 처벌은 시간(재도전)뿐, 진행도는 잃지 않는다

export const LEAGUE_NAMES = Object.freeze({
  amateur: '아마추어 리그', third: '3부 리그', second: '2부 리그', first: '1부 리그', world: '세계대회',
});

// 리그별 라이벌 (설계서 5.3 — 라이벌은 고유 패턴). 이름·별명·대사는 스토리(story.js, files/스토리라인.md)가 정본, style 은 AI 구질 성향.
// line = 경기 전 대사(홈 화면의 '다음 경기'), firstLine = 첫 등장 대사(시즌 시작 화면).
export const RIVALS = Object.freeze(Object.fromEntries(Object.entries(RIVAL_STORY).map(([lg, r]) => [lg,
  { name: r.name, nickname: r.nickname, style: r.style, line: r.lines.pre, firstLine: r.lines.first, blurb: r.blurb }])));
// 예전 저장의 라이벌 이름(스토리 반영 전) → 새 이름. 불러올 때 라이벌 팀의 이름·성향을 새 정의로 바꾼다
const LEGACY_RIVAL_NAMES = ['동호회장', '스핀 소년', '철벽 수비수', '챔피언 한', '탁구 황제'];

// 리그는 개인전: 상대 선수는 리그마다 개성 있는 별명을 가진다 (라이벌은 RIVALS). 한 리그에 비라이벌 8명
export const PLAYER_NAMES = Object.freeze({
  amateur: ['점심시간 박과장', '새벽반 영희', '막내 준호', '배달왕 대성', '고딩 민재', '야간조 미라', '터줏대감 할배', '슬리퍼 철수'],
  third: ['번개손 민수', '회전마녀 소라', '돌직구 태호', '그림자 지훈', '불꽃 서연', '철가면 동혁', '바람 도윤', '황소 상철'],
  second: ['칼날 서진', '안개 하윤', '쇠망치 대현', '여우 지아', '폭풍 우빈', '늑대 재민', '느림보 거북', '독수리 채원'],
  first: ['백전노장 오사장', '총알 현우', '얼음여왕 세아', '천재소년 리안', '강철 마동', '질풍 다온', '달인 구본', '검은 호랑이'],
  world: ['은빛 칼날 이안', '불사조 사라', '북극성 선', '번개왕 장', '침묵의 사냥꾼', '황금손 마르코', '폭군 이반', '안개 속 하루'],
});
// 예전 저장(팀 이름) 호환: 이 이름이면 새 선수 이름으로 바꿔 불러온다
const LEGACY_TEAM_NAMES = ['번개 클럽', '푸른 파도', '붉은 여우', '철새 탁구단', '한강 스매시', '달빛 스핀', '황금 라켓', '북극곰 팀', '새벽 랠리'];

// ---- 장비 (설계서 7.3, 7.4) ----
export const GRIPS = Object.freeze({
  shake: { name: '셰이크핸드', desc: '균형형', mod: { power: 0, spin: 0, focus: 0 } },
  pen: { name: '펜홀더', desc: '공격형 (파워+1 스핀+1 집중-1)', mod: { power: 1, spin: 1, focus: -1 } },
});
export const RACKETS = Object.freeze({
  basic: { name: '기본 라켓', desc: '무보정', mod: { power: 0, spin: 0, focus: 0 } },
  smasher: { name: '스매셔', desc: '파워+2 집중-1', mod: { power: 2, spin: 0, focus: -1 } },
  spinner: { name: '회전왕', desc: '스핀+2 파워-1', mod: { power: -1, spin: 2, focus: 0 } },
  wall: { name: '철벽', desc: '집중+2 파워-1', mod: { power: -1, spin: 0, focus: 2 } },
  emperor: { name: '황제의 라켓', desc: '전 스탯+1', mod: { power: 1, spin: 1, focus: 1 } },
});
/** 해당 리그 우승 시 해금 (펜홀더는 2부 승격 = 3부 우승) */
export const UNLOCKS = Object.freeze({
  amateur: { grips: [], rackets: [] },
  third: { grips: ['pen'], rackets: ['smasher'] },
  second: { grips: [], rackets: ['spinner'] },
  first: { grips: [], rackets: ['wall'] },
  world: { grips: [], rackets: ['emperor'] },
});

registerUnlocks(UNLOCKS);

/**
 * 해금 조건 문구 (UNLOCKS 표에서 파생 → 표와 문구가 어긋나지 않는다).
 * kind: 'grip' | 'racket'. 처음부터 쓸 수 있으면 null.
 */
export function unlockCondition(kind, id) {
  const key = kind === 'grip' ? 'grips' : 'rackets';
  const league = Object.keys(UNLOCKS).find((l) => UNLOCKS[l][key].includes(id));
  if (!league) return null;
  const promo = kind === 'grip' && league === 'third' ? ' (2부 승격 시)' : '';
  return `${LEAGUE_NAMES[league].replace(' 리그', '')} 우승 시 해금${promo}`;
}

/** 장비 효과는 스탯에 합산 (최소 0) */
export function effectiveStats(state) {
  const g = GRIPS[state.grip].mod;
  const r = RACKETS[state.racket].mod;
  const out = {};
  const bonus = statBonus(state); // 계승 보너스·성장 프로젝트 (roguelike.js): 투자한 스탯(raw)에 더해 곡선을 통과 → 수확체감이 적용돼 중첩해도 폭주하지 않는다(장비와 달리)
  for (const k of ['power', 'spin', 'focus']) out[k] = Math.max(0, statCurve(state.stats[k] + bonus[k]) + g[k] + r[k]);
  return out;
}

export function equip(state, grip, racket) {
  if (!state.unlocked.grips.includes(grip)) throw new Error(`잠긴 그립: ${grip}`);
  if (!state.unlocked.rackets.includes(racket)) throw new Error(`잠긴 라켓: ${racket}`);
  state.grip = grip;
  state.racket = racket;
}

// ---- 일정 ----
/** 원형 대진(circle method): 10명 → 9라운드 × 5경기, 모든 선수 쌍이 정확히 한 번씩 */
export function roundRobin(n = 10) {
  const ids = Array.from({ length: n }, (_, i) => i);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([ids[i], ids[n - 1 - i]]);
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()); // 첫 선수 고정, 나머지 회전
  }
  return rounds;
}

const TIER_ORDER = { low: 0, mid: 1, high: 2, rival: 3 };
/** 내 경기 순서를 약한 상대 → 강한 상대(하위 → 중위 → 상위 → 라이벌)로: 라운드째 재배열하므로 각 라운드는 여전히 완전한 대진이다 (게임성 리뷰 #1) */
export function orderRoundsByTier(rounds, teams) {
  const opp = (r) => { const pair = r.find((p) => p.includes(0)); return teams[pair[0] === 0 ? pair[1] : pair[0]]; };
  return rounds.map((r, i) => ({ r, i, k: TIER_ORDER[opp(r).tier] ?? 1 })).sort((a, b) => a.k - b.k || a.i - b.i).map((x) => x.r);
}

/** 시즌 변주용 결정적 난수 (mulberry32) — 경기·AI 난수와 분리 */
function variantRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 컨디션 폭: 중위·상위급은 시즌마다 ±COND_SPAN 만큼 리턴율·정확도가 달라진다 (게임성 리뷰 #3c) — 같은 '중위'도 올해는 강하거나 약하다 */
export const COND_SPAN = { low: 0.03, mid: 0.05, high: 0.05, rival: 0 };

/**
 * variant: 0 = 첫 도전(예전과 동일한 편성), 1 이상 = 재도전 — 라이벌 외 8명의 등급 배치를 섞고 이름을 돌려서 같은 리그 재도전이 똑같은 8경기가 되지 않게 한다 (게임성 리뷰 #11).
 * seed: 시즌·리그로 정해지는 컨디션/셔플 시드
 */
export function buildTeams(league, cycle = 1, variant = 0, seed = 0) {
  const rivalIdx = 8; // 상위권 한 명을 라이벌로
  const teams = [{ id: 0, name: '나', me: true }];
  const rnd = variantRng(Math.imul(seed + 1, 2654435761) ^ Math.imul(variant + 7, 40503));
  const tiers = TIER_LAYOUT.slice();
  if (variant > 0) { const head = tiers.slice(0, rivalIdx); for (let i = head.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [head[i], head[j]] = [head[j], head[i]]; } tiers.splice(0, rivalIdx, ...head); }
  const names = PLAYER_NAMES[league];
  tiers.forEach((tier, i) => {
    const isRival = i === rivalIdx;
    const cond = variant > 0 || seed > 0 ? Math.round((rnd() * 2 - 1) * (COND_SPAN[isRival ? 'rival' : tier] ?? 0) * 1000) / 1000 : 0;
    teams.push({
      id: i + 1,
      name: isRival ? RIVALS[league].name : names[variant > 0 ? (i + variant) % rivalIdx : i],
      tier: isRival ? 'rival' : tier, cond,
      style: isRival ? (cycle >= 2 ? RIVAL_CYCLE[league]?.style ?? RIVALS[league].style : RIVALS[league].style) : 'balanced',
      rival: isRival,
    });
  });
  return teams.map((t) => ({ ...t, points: 0, wins: 0, losses: 0, diff: 0 }));
}

/** 시즌 초기화: 선수/일정/기록 리셋 (스탯·장비·포인트는 유지) */
export function startSeason(state, league = state.league) {
  state.league = league;
  const variant = Math.max(0, (state.retries?.[league] ?? 0)); // 같은 리그를 다시 하는 횟수(첫 도전 = 0)
  state.teams = buildTeams(league, state.cycle ?? 1, variant, variant > 0 ? state.season * 31 + LEAGUES.indexOf(league) : 0);
  state.revenge = variant > 0 ? { open: true } : null; // 재도전 시즌에만 열리는 라이벌 설욕전 (한 번)
  state.schedule = orderRoundsByTier(roundRobin(10), state.teams);
  state.week = 1;
  state.phase = 'regular'; // regular | tournament | seasonEnd
  state.log = []; // { a, b, winner, sa, sb, stage }
  state.bracket = null;
  state.summary = null;
  state.seasonTally = emptyTally(); // 이번 시즌 경기 집계 (결산 레이더용)
  state.cup = null; state.cupsDone = []; // 월간 컵은 시즌마다 새로
  resetSeasonBuild(state); // 시즌 빌드(드래프트 특성)는 시즌 한정
  return state;
}

export function newGame(league = 'amateur') {
  const state = {
    version: SAVE_VERSION,
    season: 1,
    stats: { power: 3, spin: 3, focus: 3 },
    statPoints: 0,
    grip: 'shake',
    racket: 'basic',
    unlocked: { grips: ['shake'], rackets: ['basic'] },
    cleared: false, // 세계대회 우승(엔딩 달성)
    endingPending: false,
    cycle: 1, // 회차 (세계대회 우승 후 2회차를 시작하면 +1: 라이벌 변주)
    retries: {}, // 리그별 연속 실패 횟수 (우승하면 지움) — 재도전 안내용
    story: { seen: [], met: [], rivalLosses: {} }, // 본 스토리 비트·만난 라이벌·라이벌전 패배 수 (story.js)
    trophies: {}, title: null, skin: 'default', // 우승 특전 (perks.js)
    events: { history: [] }, // 커리어 이벤트 선택 기록 (events.js)
    cupHistory: [], // 월간 컵 성적 (cup.js)
    radarPrev: null, // 지난 시즌 결산 레이더 (성장 비교용)
    rogue: emptyRogue(), // 계승 보너스·시즌 빌드·라이벌 전적·성장 줄기 (roguelike.js)
  };
  return startSeason(state, league);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** 세계대회 계속(엔딩 후 같은 리그 반복) 때 시즌마다 쌓이는 상대 난이도 (게임성 리뷰 #4) */
export const WORLD_EXTRA_STEP = 0.02; export const WORLD_EXTRA_MAX = 0.08;
export function aiParamsFor(state, team) {
  const p = makeAiParams(state.league, team.tier, team.style, state.cycle ?? 1);
  const bump = (team.cond ?? 0) + (state.league === 'world' ? Math.min(WORLD_EXTRA_MAX, WORLD_EXTRA_STEP * (state.worldExtra ?? 0)) : 0);
  return bump ? { ...p, returnRate: clamp01(p.returnRate + bump), accuracy: clamp01(p.accuracy + bump) } : p;
}
/** 지금 회차 기준 라이벌 소개·대사 (1회차는 RIVALS 와 동일) */
export function rivalFor(state) {
  const r = rivalStory(state.league, state.cycle ?? 1);
  return r ? { name: r.name, nickname: r.nickname, style: r.style, line: r.lines.pre, firstLine: r.lines.first, blurb: r.blurb } : null;
}
export const teamById = (state, id) => state.teams[id];
export const leagueIndex = (state) => LEAGUES.indexOf(state.league);

/** 회차 필드 보강 (예전 저장에는 없다 = 1회차) */
function ensureCycle(state) {
  if (!Number.isInteger(state.cycle) || state.cycle < 1) state.cycle = 1;
  return state.cycle;
}
/** 재도전 횟수 필드 보강 (예전 저장에는 없다) */
function ensureExtras(state) {
  ensureEvents(state); ensureTally(state); ensurePerks(state, { retro: state.trophies === undefined });
  if (!Array.isArray(state.cupHistory)) state.cupHistory = [];
  if (!Array.isArray(state.cupsDone)) state.cupsDone = [];
  if (state.cup === undefined || (state.cup !== null && (typeof state.cup !== 'object' || !state.cup.rounds))) state.cup = null;
  if (state.radarPrev === undefined) state.radarPrev = null;
  ensureRogue(state);
  if (state.revenge === undefined) state.revenge = null;
  if (!Number.isFinite(state.worldExtra) || state.worldExtra < 0) state.worldExtra = 0;
  if (!Number.isFinite(state.worldStreak) || state.worldStreak < 0) state.worldStreak = 0;
  // 강등 삭제(2026-10-12) 이전 저장: 시즌 종료 화면에서 대기 중이던 강등은 취소 — 진행도는 잃지 않는다
  if (state.summary?.relegated) { state.summary.nextLeague = state.summary.league; state.summary.relegated = false; state.summary.relegationRisk = false; }
  return state;
}
/** 재도전 횟수 필드 보강 (예전 저장에는 없다) */
function ensureRetries(state) {
  if (!state.retries || typeof state.retries !== 'object' || Array.isArray(state.retries)) state.retries = {};
  return state.retries;
}

/** 저장 데이터 마이그레이션: v1 → v2 (일정/로그/국면 보강). 알 수 없으면 null */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !raw.stats || !LEAGUES.includes(raw.league)) return null;
  if (raw.version === SAVE_VERSION && raw.teams && raw.schedule) { renameLegacyTeams(raw); ensureStory(raw); ensureRetries(raw); ensureCycle(raw); ensureExtras(raw); return raw; }
  const s = newGame(raw.league);
  s.stats = { power: raw.stats.power ?? 3, spin: raw.stats.spin ?? 3, focus: raw.stats.focus ?? 3 };
  s.statPoints = raw.statPoints ?? 0;
  if (raw.unlocked) s.unlocked = raw.unlocked;
  if (raw.grip && s.unlocked.grips.includes(raw.grip)) s.grip = raw.grip;
  if (raw.racket && s.unlocked.rackets.includes(raw.racket)) s.racket = raw.racket;
  ensureStory(s);
  ensureRetries(s);
  s.cycle = Math.max(1, Math.floor(raw.cycle ?? 1));
  s.cleared = !!raw.cleared; delete s.trophies; // v1 저장: 우승 특전은 소급 지급
  ensureExtras(s);
  return s; // 진행 중이던 주차는 새 시즌으로 초기화 (스탯/포인트/장비 유지)
}

// ---- 정규 리그 ----
export function weekOpponent(state) {
  if (state.phase !== 'regular') return null;
  const pair = state.schedule[state.week - 1].find((p) => p.includes(0));
  return teamById(state, pair[0] === 0 ? pair[1] : pair[0]);
}

function record(state, a, b, winner, sa, sb, stage = 'regular') {
  const loser = winner === a ? b : a;
  const W = state.teams[winner]; const L = state.teams[loser];
  if (stage === 'regular') {
    W.wins += 1; L.losses += 1; W.points += 3;
    const d = Math.abs(sa - sb);
    W.diff += d; L.diff -= d;
  }
  state.log.push({ a, b, winner, sa, sb, stage });
}

function quickScore(rng) { return Math.floor(rng.next() * 10); } // 패자 점수 0..9

export function quickPlay(state, a, b, rng) {
  const side = simulateQuick(aiParamsFor(state, state.teams[a]), aiParamsFor(state, state.teams[b]), rng);
  const winner = side === 'me' ? a : b;
  const loserScore = quickScore(rng);
  return { winner, sa: winner === a ? 11 : loserScore, sb: winner === b ? 11 : loserScore };
}

/** 순위: 승점 → 승자승(동점 그룹 내 맞대결 승점) → 득실차 → id */
export function ranking(state) {
  const teams = state.teams.map((t) => ({ ...t }));
  const h2h = (t, group) => state.log.filter((g) => g.stage === 'regular' && g.winner === t.id
    && group.includes(g.a) && group.includes(g.b)).length * 3;
  teams.sort((x, y) => y.points - x.points);
  // 동점 그룹 정렬
  const out = [];
  for (let i = 0; i < teams.length;) {
    let j = i;
    while (j < teams.length && teams[j].points === teams[i].points) j++;
    const grp = teams.slice(i, j);
    const ids = grp.map((t) => t.id);
    grp.sort((x, y) => h2h(y, ids) - h2h(x, ids) || y.diff - x.diff || x.id - y.id);
    out.push(...grp);
    i = j;
  }
  return out.map((t, k) => ({ ...t, rank: k + 1 }));
}
export const standings = ranking;

/**
 * 내 정규 경기 결과 반영 + 같은 라운드의 AI 경기 시뮬레이션(preset 이 있으면 그 결과) + 주차 진행.
 * 반환: { gained, phase }
 */
export function applyRegularResult(state, { won, score }, rng, preset = {}) {
  if (state.phase !== 'regular') throw new Error('정규 리그 중이 아님');
  const opp = weekOpponent(state);
  const round = state.schedule[state.week - 1];
  const winner = won ? 0 : opp.id;
  record(state, 0, opp.id, winner, won ? score.me : score.opp, won ? score.opp : score.me);
  // 내 점수는 a(=0) 기준으로 기록
  state.log[state.log.length - 1].sa = score.me;
  state.log[state.log.length - 1].sb = score.opp;
  for (const [a, b] of round) {
    if (a === 0 || b === 0) continue;
    const r = preset[`${a}-${b}`] ?? quickPlay(state, a, b, rng); // preset: 경기 중 속보(liveRound)로 이미 보여준 다른 경기 결과 — 순위표와 어긋나지 않게 그대로 반영
    record(state, a, b, r.winner, r.sa, r.sb);
  }
  const pts = awardBonusPoints(state, won ? WIN_PT : LOSE_PT, { won, rival: !!opp.rival });
  const gained = pts.total;
  state.statPoints += gained;
  if (opp.rival) recordRival(state, won);
  const rivalPt = opp.rival && won ? rivalWinBonus(state) : 0;
  const draft = checkDraft(state, state.week); // 정규 2·4·6번째 경기 뒤(승패 무관): 특성 드래프트
  state.week += 1;
  if (state.week > 9) startTournament(state, rng);
  return { gained, bonus: pts.bonus, rivalPt, draft, phase: state.phase };
}

/** 라이벌전 승리 보상: 계승 포인트 +1 (게임성 리뷰 #9). 반환: 지급한 포인트 */
export const RIVAL_WIN_LEGACY_PT = 1;
function rivalWinBonus(state) { ensureRogue(state).points += RIVAL_WIN_LEGACY_PT; return RIVAL_WIN_LEGACY_PT; }

// ---- 라이벌 설욕전 (재도전 시즌 한정, 게임성 리뷰 #3a·#5·#11) ----
// 전 시즌에 목표를 못 이룬 같은 리그를 다시 할 때 열린다. 정규 시즌 일정과 별개의 한 판(승패 무관 1회): 이기면 스탯 포인트 +REVENGE_WIN_POINTS 와 라이벌전 승리 보너스, 져도 잃는 것 없음.
export const REVENGE_WIN_POINTS = 4;
export function revengeOffer(state) {
  if (state.phase !== 'regular' || !state.revenge?.open) return null;
  const rival = state.teams.find((t) => t.rival);
  return rival ? { opp: rival, points: REVENGE_WIN_POINTS } : null;
}
export function applyRevengeResult(state, { won }) {
  if (!state.revenge?.open) throw new Error('열린 설욕전이 없음');
  state.revenge = { open: false, won: !!won };
  const rec = recordRival(state, won);
  let gained = 0; let rivalPt = 0;
  if (won) { gained = REVENGE_WIN_POINTS; state.statPoints += gained; rivalPt = rivalWinBonus(state); }
  return { gained, rivalPt, record: rec, done: true };
}

// ---- 토너먼트 ----
function startTournament(state, rng) {
  const top = ranking(state).slice(0, 4).map((t) => t.id);
  state.phase = 'tournament';
  state.bracket = {
    semis: [{ a: top[0], b: top[3], winner: null, sa: null, sb: null }, { a: top[1], b: top[2], winner: null, sa: null, sb: null }],
    final: { a: null, b: null, winner: null, sa: null, sb: null },
  };
  advanceBracket(state, rng);
}

const involvesMe = (m) => m.a === 0 || m.b === 0;

/** 나와 무관한 경기를 모두 시뮬레이션하고, 모든 경기가 끝나면 시즌 종료 */
export function advanceBracket(state, rng) {
  const br = state.bracket;
  const settle = (m) => {
    if (m.winner !== null || m.a === null || m.b === null || involvesMe(m)) return;
    const r = quickPlay(state, m.a, m.b, rng);
    Object.assign(m, { winner: r.winner, sa: r.sa, sb: r.sb });
    state.log.push({ a: m.a, b: m.b, winner: r.winner, sa: r.sa, sb: r.sb, stage: 'tournament' });
  };
  br.semis.forEach(settle);
  if (br.semis.every((m) => m.winner !== null)) {
    br.final.a = br.semis[0].winner;
    br.final.b = br.semis[1].winner;
    settle(br.final);
  }
  if (br.final.winner !== null) finishSeason(state);
}

/** 내가 치를 다음 토너먼트 경기의 상대 (없으면 null = 탈락/미진출) */
export function tournamentOpponent(state) {
  if (state.phase !== 'tournament') return null;
  const br = state.bracket;
  const m = [...br.semis, br.final].find((x) => x.winner === null && x.a !== null && x.b !== null && involvesMe(x));
  return m ? teamById(state, m.a === 0 ? m.b : m.a) : null;
}

export function applyTournamentResult(state, { won, score }, rng) {
  if (state.phase !== 'tournament') throw new Error('토너먼트 중이 아님');
  const br = state.bracket;
  const m = [...br.semis, br.final].find((x) => x.winner === null && x.a !== null && x.b !== null && involvesMe(x));
  if (!m) throw new Error('치를 토너먼트 경기가 없음');
  const opp = m.a === 0 ? m.b : m.a;
  Object.assign(m, { winner: won ? 0 : opp, sa: m.a === 0 ? score.me : score.opp, sb: m.a === 0 ? score.opp : score.me });
  state.log.push({ a: m.a, b: m.b, winner: m.winner, sa: m.sa, sb: m.sb, stage: 'tournament' });
  const oppTeam = teamById(state, opp);
  const pts = awardBonusPoints(state, won ? WIN_PT : LOSE_PT, { won, rival: !!oppTeam.rival });
  const gained = pts.total;
  state.statPoints += gained;
  if (oppTeam.rival) recordRival(state, won);
  const rivalPt = oppTeam.rival && won ? rivalWinBonus(state) : 0;
  advanceBracket(state, rng);
  return { gained, bonus: pts.bonus, rivalPt, draft: false, phase: state.phase };
}

// ---- 시즌 종료 ----
function finishSeason(state) {
  const champion = state.bracket.final.winner;
  const rank = ranking(state).find((t) => t.id === 0).rank;
  const iWon = champion === 0;
  const prevLeague = state.league;
  const summary = {
    league: prevLeague, season: state.season, rank, champion: iWon, championName: state.teams[champion].name,
    promoted: false, nextLeague: prevLeague, unlocked: { grips: [], rackets: [] }, ending: false,
  };
  // 시즌 목표 달성 여부 (시즌 시작 화면의 목표와 같은 기준) + 연속 실패(재도전) 횟수
  const lastLeague = LEAGUES.indexOf(prevLeague) === LEAGUES.length - 1;
  summary.goals = [
    { id: 'top4', label: '정규 시즌 상위 4위', met: rank <= 4 },
    { id: 'title', label: lastLeague ? '세계대회 우승' : '토너먼트 우승 (승격)', met: iWon },
  ];
  const retries = ensureRetries(state);
  if (iWon) delete retries[prevLeague]; else retries[prevLeague] = (retries[prevLeague] ?? 0) + 1;
  summary.cycleOffer = lastLeague && iWon; // 세계대회 우승: 2회차 시작을 고를 수 있다 (기본 흐름은 그대로 세계대회 계속)
  summary.retryCount = retries[prevLeague] ?? 0; // 같은 리그를 다시 도전하는 횟수 (우승이면 0)
  summary.relegated = false; summary.relegationRisk = false; // 강등 없음 (구 저장·화면 호환 필드)
  if (iWon) {
    summary.perks = grantPerks(state, prevLeague); // 우승 특전: 트로피·칭호·스킨 (스탯 포인트 보너스는 폐지)
    const un = UNLOCKS[prevLeague];
    for (const g of un.grips) if (!state.unlocked.grips.includes(g)) { state.unlocked.grips.push(g); summary.unlocked.grips.push(g); }
    for (const r of un.rackets) if (!state.unlocked.rackets.includes(r)) { state.unlocked.rackets.push(r); summary.unlocked.rackets.push(r); }
    const idx = LEAGUES.indexOf(prevLeague);
    if (idx < LEAGUES.length - 1) { summary.promoted = true; summary.nextLeague = LEAGUES[idx + 1]; }
    else if (!state.cleared) { state.cleared = true; summary.ending = true; state.endingPending = true; }
  }
  if (prevLeague === 'world' && (state.cleared || iWon)) { state.worldStreak = iWon ? (state.worldStreak ?? 0) + 1 : 0; summary.worldStreak = state.worldStreak; } // 세계대회 연속 우승 기록
  summary.legacy = settleSeason(state, { champion: iWon, rank }); // 계승 포인트 지급 + 시즌 빌드 소멸 (A/B 연결)
  const me = state.teams[0];
  summary.review = buildReview(state, { rank, wins: me.wins, losses: me.losses }, effectiveStats(state)); // 결산: 6각 레이더·전적·순위
  state.summary = summary;
  state.phase = 'seasonEnd';
}

/** 시즌 종료 화면 확인 후 다음 시즌 시작 (승격이면 상위 리그) */
export function startNextSeason(state) {
  if (state.phase !== 'seasonEnd') throw new Error('시즌이 끝나지 않음');
  const next = state.summary.nextLeague;
  state.season += 1;
  state.endingPending = false;
  if (state.league === 'world' && state.cleared && !state.summary?.ending) state.worldExtra = (state.worldExtra ?? 0) + 1; // 세계대회 계속: 시즌마다 상대가 조금씩 강해진다
  startSeason(state, next);
  if ((ensureRetries(state)[state.league] ?? 0) > 0) openRetryDraft(state); // 재도전 시즌: 1주차 전에 드래프트 1회 선지급
  return state;
}

/** 2회차 시작: 아마추어부터 다시 (스탯·장비·포인트·해금 유지, 라이벌 변주). 세계대회 우승 직후에만 */
export function startCycle(state) {
  if (state.phase !== 'seasonEnd' || !state.summary?.cycleOffer) throw new Error('세계대회 우승 직후에만 2회차를 시작할 수 있음');
  state.cycle = ensureCycle(state) + 1;
  state.worldExtra = 0; state.worldStreak = 0;
  state.season += 1;
  state.endingPending = false;
  state.retries = {};
  return startSeason(state, 'amateur');
}

/** 대진표 표시용 뷰모델 (선수 이름 해석) */
export function bracketView(state) {
  const br = state.bracket;
  if (!br) return null;
  const nm = (id) => (id === null ? null : state.teams[id].name);
  const view = (m) => ({
    a: nm(m.a), b: nm(m.b), winner: nm(m.winner),
    score: m.winner === null ? null : `${m.sa}:${m.sb}`,
  });
  return { semis: br.semis.map(view), final: view(br.final) };
}

/** 지금 내가 칠 경기의 상대와 구분 */
export function nextMatch(state) {
  if (state.phase === 'regular') return { stage: 'regular', opp: weekOpponent(state) };
  if (state.phase === 'tournament') {
    const opp = tournamentOpponent(state);
    return opp ? { stage: 'tournament', opp } : null;
  }
  return null;
}

/**
 * 시즌 시작 연출용 목표 요약 (순수 데이터). 규칙은 이 파일의 상수·함수와 같은 출처를 쓴다.
 * 반환: { title, subtitle, goals:[{icon,label,text}], rival }
 */
export function seasonGoals(state) {
  const idx = LEAGUES.indexOf(state.league);
  const last = idx === LEAGUES.length - 1;
  const next = last ? null : LEAGUE_NAMES[LEAGUES[idx + 1]];
  const rival = rivalFor(state);
  const unlock = UNLOCKS[state.league];
  const names = [...unlock.grips.map((g) => GRIPS[g].name), ...unlock.rackets.map((r) => RACKETS[r].name)];
  const goals = [
    { icon: '🏓', label: '정규 시즌', text: '9경기 풀리그에서 상위 4위 안에 들기' },
    { icon: '🏆', label: '연말 토너먼트', text: last ? '세계대회 우승으로 정상에 서기' : `우승하면 ${next} 승격` },
    { icon: '🎁', label: '우승 보상', text: `트로피 · 칭호「${CHAMPION_PERKS[state.league].title}」 · 스킨「${CHAMPION_PERKS[state.league].skin}」${names.length ? ` · 해금: ${names.join(', ')}` : ''}` },
  ];
  const retry = ensureRetries(state)[state.league] ?? 0;
  if (retry > 0) goals.push({ icon: '🔁', label: '재도전', text: `지난 시즌은 목표에 닿지 못했어요 — 훈련으로 감각을 다듬고 ${retry + 1}번째 도전!` });
  return {
    title: LEAGUE_NAMES[state.league], subtitle: `${state.season}시즌${(state.cycle ?? 1) >= 2 ? ` · ${state.cycle}회차` : ''}${retry > 0 ? ` · ${retry + 1}번째 도전` : ' 시작'}`, goals,
    rival: rival ? { name: rival.name, nickname: rival.nickname, line: rival.blurb } : null, // 소개 한 줄 (대사는 라이벌전 직전 카드에서 처음 나온다)
  };
}

/** 예전 저장의 팀 이름(번개 클럽 …)을 개인전 선수 이름으로 바꾼다 (id 순서 그대로, 라이벌·나는 유지) */
function renameLegacyTeams(state) {
  const names = PLAYER_NAMES[state.league];
  if (!names || !Array.isArray(state.teams)) return;
  for (const t of state.teams) if (!t.me && !t.rival && LEGACY_TEAM_NAMES.includes(t.name) && names[t.id - 1]) t.name = names[t.id - 1];
  const rv = RIVALS[state.league]; // 라이벌: 스토리 이름·성향으로 (옛 이름일 때만 — 이미 새 이름이면 그대로)
  for (const t of state.teams) if (t.rival && rv && LEGACY_RIVAL_NAMES.includes(t.name)) { t.name = rv.name; t.style = rv.style; }
}
