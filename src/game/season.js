import { LEAGUES, TIER_LAYOUT, makeAiParams, simulateQuick } from '../core/index.js?v=1791358894';
import { RIVAL_STORY, ensureStory } from './story.js?v=1791358894';
import { statCurve } from './statcurve.js?v=1791358894';

export const SAVE_VERSION = 2;
export const WIN_PT = 3;
export const LOSE_PT = 1;
export const CHAMPION_BONUS = 5;

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
  for (const k of ['power', 'spin', 'focus']) out[k] = Math.max(0, statCurve(state.stats[k]) + g[k] + r[k]);
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

function buildTeams(league) {
  const rivalIdx = 8; // 상위권 한 명을 라이벌로
  const teams = [{ id: 0, name: '나', me: true }];
  TIER_LAYOUT.forEach((tier, i) => {
    const isRival = i === rivalIdx;
    teams.push({
      id: i + 1,
      name: isRival ? RIVALS[league].name : PLAYER_NAMES[league][i],
      tier: isRival ? 'rival' : tier,
      style: isRival ? RIVALS[league].style : 'balanced',
      rival: isRival,
    });
  });
  return teams.map((t) => ({ ...t, points: 0, wins: 0, losses: 0, diff: 0 }));
}

/** 시즌 초기화: 선수/일정/기록 리셋 (스탯·장비·포인트는 유지) */
export function startSeason(state, league = state.league) {
  state.league = league;
  state.teams = buildTeams(league);
  state.schedule = roundRobin(10);
  state.week = 1;
  state.phase = 'regular'; // regular | tournament | seasonEnd
  state.log = []; // { a, b, winner, sa, sb, stage }
  state.bracket = null;
  state.summary = null;
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
    story: { seen: [], met: [], rivalLosses: {} }, // 본 스토리 비트·만난 라이벌·라이벌전 패배 수 (story.js)
  };
  return startSeason(state, league);
}

export const aiParamsFor = (state, team) => makeAiParams(state.league, team.tier, team.style);
export const teamById = (state, id) => state.teams[id];
export const leagueIndex = (state) => LEAGUES.indexOf(state.league);

/** 저장 데이터 마이그레이션: v1 → v2 (일정/로그/국면 보강). 알 수 없으면 null */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object' || !raw.stats || !LEAGUES.includes(raw.league)) return null;
  if (raw.version === SAVE_VERSION && raw.teams && raw.schedule) { renameLegacyTeams(raw); ensureStory(raw); return raw; }
  const s = newGame(raw.league);
  s.stats = { power: raw.stats.power ?? 3, spin: raw.stats.spin ?? 3, focus: raw.stats.focus ?? 3 };
  s.statPoints = raw.statPoints ?? 0;
  if (raw.unlocked) s.unlocked = raw.unlocked;
  if (raw.grip && s.unlocked.grips.includes(raw.grip)) s.grip = raw.grip;
  if (raw.racket && s.unlocked.rackets.includes(raw.racket)) s.racket = raw.racket;
  ensureStory(s);
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

function quickPlay(state, a, b, rng) {
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
 * 내 정규 경기 결과 반영 + 같은 라운드의 AI 경기 시뮬레이션 + 주차 진행.
 * 반환: { gained, phase }
 */
export function applyRegularResult(state, { won, score }, rng) {
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
    const r = quickPlay(state, a, b, rng);
    record(state, a, b, r.winner, r.sa, r.sb);
  }
  const gained = won ? WIN_PT : LOSE_PT;
  state.statPoints += gained;
  state.week += 1;
  if (state.week > 9) startTournament(state, rng);
  return { gained, phase: state.phase };
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
  const gained = won ? WIN_PT : LOSE_PT;
  state.statPoints += gained;
  advanceBracket(state, rng);
  return { gained, phase: state.phase };
}

// ---- 시즌 종료 ----
function finishSeason(state) {
  const champion = state.bracket.final.winner;
  const rank = ranking(state).find((t) => t.id === 0).rank;
  const iWon = champion === 0;
  const prevLeague = state.league;
  const summary = {
    league: prevLeague, rank, champion: iWon, championName: state.teams[champion].name,
    promoted: false, nextLeague: prevLeague, unlocked: { grips: [], rackets: [] }, bonus: 0, ending: false,
  };
  if (iWon) {
    summary.bonus = CHAMPION_BONUS;
    state.statPoints += CHAMPION_BONUS;
    const un = UNLOCKS[prevLeague];
    for (const g of un.grips) if (!state.unlocked.grips.includes(g)) { state.unlocked.grips.push(g); summary.unlocked.grips.push(g); }
    for (const r of un.rackets) if (!state.unlocked.rackets.includes(r)) { state.unlocked.rackets.push(r); summary.unlocked.rackets.push(r); }
    const idx = LEAGUES.indexOf(prevLeague);
    if (idx < LEAGUES.length - 1) { summary.promoted = true; summary.nextLeague = LEAGUES[idx + 1]; }
    else if (!state.cleared) { state.cleared = true; summary.ending = true; state.endingPending = true; }
  }
  state.summary = summary;
  state.phase = 'seasonEnd';
}

/** 시즌 종료 화면 확인 후 다음 시즌 시작 (승격이면 상위 리그) */
export function startNextSeason(state) {
  if (state.phase !== 'seasonEnd') throw new Error('시즌이 끝나지 않음');
  const next = state.summary.nextLeague;
  state.season += 1;
  state.endingPending = false;
  return startSeason(state, next);
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
  const rival = RIVALS[state.league];
  const unlock = UNLOCKS[state.league];
  const names = [...unlock.grips.map((g) => GRIPS[g].name), ...unlock.rackets.map((r) => RACKETS[r].name)];
  const goals = [
    { icon: '🏓', label: '정규 시즌', text: '9경기 풀리그에서 상위 4위 안에 들기' },
    { icon: '🏆', label: '연말 토너먼트', text: last ? '세계대회 우승으로 정상에 서기' : `우승하면 ${next} 승격` },
    { icon: '🎁', label: '우승 보상', text: `보너스 포인트 +${CHAMPION_BONUS}${names.length ? ` · 해금: ${names.join(', ')}` : ''}` },
  ];
  return {
    title: LEAGUE_NAMES[state.league], subtitle: `${state.season}시즌 시작`, goals,
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
