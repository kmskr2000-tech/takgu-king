// 월간 컵: 정규 시즌 중 열리는 8인 단판 토너먼트. 현재 리그 + 바로 위·아래 리그 선수가 섞여 나온다(상·하위 리그 교류전).
//  - 슬롯 2개(3~6주차, 7~9주차 창). 참가는 선택. 한 번 시작한 컵은 끝까지(경기 3번이 최대).
//  - 정규 시즌(주차·순위표·로그·승급·재도전 횟수)에는 아무 영향이 없다. 보상은 연말 토너먼트보다 작다: 승리마다 +1, 우승 +1 더.
//  - 모든 난수는 별도 시드 흐름(시즌·슬롯·회차로 결정) — 정규 시즌/경기 난수를 소모하지 않는다. 상대 선수는 자기 리그의 AI 설정으로 싸운다.
import { LEAGUES, makeAiParams, createRng, simulateQuick } from '../core/index.js?v=1791531091';
import { buildTeams, LEAGUE_NAMES } from './season.js?v=1791531091';

export const CUP_SLOTS = Object.freeze([{ id: 0, from: 3, to: 6 }, { id: 1, from: 7, to: 9 }]);
export const CUP_WIN_POINTS = 1;
export const CUP_CHAMPION_BONUS = 1;
const REGIONS = ['한강', '낙동강', '금강', '영산강', '섬진강', '태백', '한라', '설악'];
const HISTORY_MAX = 12;
const ROUND_NAMES = Object.freeze({ qf: '8강', sf: '4강', final: '결승' });
const PLACE = Object.freeze({ qf: '8강 탈락', sf: '4강 탈락', final: '준우승' });
const SHORT = Object.freeze({ amateur: '아마', third: '3부', second: '2부', first: '1부', world: '세계' });

const shuffle = (arr, rng) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const seedOf = (state, slot, salt) => (Math.imul(state.season * 31 + (state.cycle ?? 1) * 7 + slot * 3 + LEAGUES.indexOf(state.league) + 1, 2654435761) ^ salt) >>> 0;

/** 저장 보강 (예전 저장에는 없다) */
export function ensureCup(state) {
  if (!Array.isArray(state.cupsDone)) state.cupsDone = [];
  if (!Array.isArray(state.cupHistory)) state.cupHistory = [];
  if (state.cup === undefined || (state.cup !== null && (typeof state.cup !== 'object' || !state.cup.rounds))) state.cup = null;
  return state;
}

export const cupName = (state, slot) => `${REGIONS[(state.season + slot + (state.cycle ?? 1)) % REGIONS.length]}컵`;
export const activeCup = (state) => { ensureCup(state); return state.cup && !state.cup.done ? state.cup : null; };

/** 지금 참가 신청을 받는 컵 (없으면 null) */
export function cupOffer(state) {
  ensureCup(state);
  if (state.phase !== 'regular' || state.cup) return null;
  const slot = CUP_SLOTS.find((s) => state.week >= s.from && state.week <= s.to && !state.cupsDone.includes(s.id));
  return slot ? { slot: slot.id, name: cupName(state, slot.id), lastWeek: slot.to } : null;
}

/** 참가 포기 (이번 슬롯은 건너뜀) */
export function skipCup(state, slotId) { ensureCup(state); if (!state.cupsDone.includes(slotId)) state.cupsDone.push(slotId); }

/** 대회 시작: 8명 구성(나 + 현재 리그 3 + 위 리그 2 + 아래 리그 2; 없는 쪽은 현재 리그로 채움) + 8강 대진 */
export function startCup(state, slotId) {
  ensureCup(state);
  const offer = cupOffer(state);
  if (!offer || offer.slot !== slotId) throw new Error('지금은 컵에 참가할 수 없음');
  const rng = createRng(seedOf(state, slotId, 0xc0ffee));
  const idx = LEAGUES.indexOf(state.league);
  const cycle = state.cycle ?? 1;
  const pool = (lg) => shuffle(buildTeams(lg, cycle).filter((t) => !t.me), rng).map((t) => ({ name: t.name, league: lg, tier: t.tier, style: t.style, rival: false }));
  const up = idx < LEAGUES.length - 1 ? pool(LEAGUES[idx + 1]) : []; const down = idx > 0 ? pool(LEAGUES[idx - 1]) : []; const same = pool(state.league);
  const nUp = Math.min(2, up.length); const nDown = Math.min(2, down.length);
  const picked = [...up.slice(0, nUp), ...down.slice(0, nDown), ...same.slice(0, 7 - nUp - nDown)];
  const entrants = [{ name: '나', league: state.league, me: true }, ...shuffle(picked, rng)];
  const order = shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng);
  const m = (a, b) => ({ a, b, winner: null, sa: null, sb: null });
  state.cup = {
    slot: slotId, name: cupName(state, slotId), season: state.season, entrants, done: false, champion: null, place: null, gained: 0, round: 'qf',
    rounds: { qf: [m(order[0], order[1]), m(order[2], order[3]), m(order[4], order[5]), m(order[6], order[7])], sf: [], final: [] },
  };
  settle(state);
  return state.cup;
}

const paramsOf = (state, e) => makeAiParams(e.league, e.tier ?? 'mid', e.style ?? 'balanced', state.cycle ?? 1);
export const cupParams = (state, opp) => paramsOf(state, opp);
const involvesMe = (m) => m.a === 0 || m.b === 0;

/** 나와 무관한 경기를 모두 시뮬레이션하고, 라운드가 끝나면 다음 라운드를 짠다. 내 경기가 남아 있으면 거기서 멈춘다 */
function settle(state) {
  const cup = state.cup;
  for (let guard = 0; guard < 8 && !cup.done; guard++) {
    const ms = cup.rounds[cup.round];
    const rng = createRng(seedOf(state, cup.slot, 0xbeef + ['qf', 'sf', 'final'].indexOf(cup.round))); // 라운드마다 다른 시드 흐름
    for (const m of ms) {
      if (m.winner !== null || involvesMe(m)) continue;
      const side = simulateQuick(paramsOf(state, cup.entrants[m.a]), paramsOf(state, cup.entrants[m.b]), rng);
      const winner = side === 'me' ? m.a : m.b; const ls = Math.floor(rng.next() * 10);
      Object.assign(m, { winner, sa: winner === m.a ? 11 : ls, sb: winner === m.b ? 11 : ls });
    }
    if (ms.some((m) => m.winner === null)) return; // 내 경기 대기
    if (cup.round === 'final') { finish(state, ms[0].winner); return; }
    const winners = ms.map((m) => m.winner); const next = cup.round === 'qf' ? 'sf' : 'final';
    cup.rounds[next] = []; for (let i = 0; i < winners.length; i += 2) cup.rounds[next].push({ a: winners[i], b: winners[i + 1], winner: null, sa: null, sb: null });
    cup.round = next;
  }
}

function finish(state, champion) {
  const cup = state.cup;
  cup.done = true; cup.champion = champion;
  const mine = [...cup.rounds.qf, ...cup.rounds.sf, ...cup.rounds.final].filter(involvesMe);
  const lost = mine.find((m) => m.winner !== null && m.winner !== 0);
  cup.place = champion === 0 ? '우승' : PLACE[['qf', 'sf', 'final'].find((r) => cup.rounds[r].includes(lost))] ?? '탈락';
  if (champion === 0) { cup.gained += CUP_CHAMPION_BONUS; state.statPoints += CUP_CHAMPION_BONUS; }
  state.cupsDone.push(cup.slot);
  state.cupHistory.push({ season: cup.season, slot: cup.slot, name: cup.name, place: cup.place });
  if (state.cupHistory.length > HISTORY_MAX) state.cupHistory.splice(0, state.cupHistory.length - HISTORY_MAX);
}

/** 내가 칠 다음 컵 경기 (없으면 null). opp 는 컵 참가자(리그·등급 포함) */
export function cupMatch(state) {
  const cup = activeCup(state);
  if (!cup) return null;
  const m = cup.rounds[cup.round].find((x) => x.winner === null && involvesMe(x));
  if (!m) return null;
  const opp = cup.entrants[m.a === 0 ? m.b : m.a];
  return { stage: 'cup', round: cup.round, roundName: ROUND_NAMES[cup.round], opp: { ...opp, tag: SHORT[opp.league] } };
}

/** 내 컵 경기 결과 반영 (정규 시즌 상태는 건드리지 않는다). 반환: { gained, done, place } */
export function applyCupResult(state, { won, score }) {
  const cup = activeCup(state);
  if (!cup) throw new Error('진행 중인 컵이 없음');
  const m = cup.rounds[cup.round].find((x) => x.winner === null && involvesMe(x));
  if (!m) throw new Error('치를 컵 경기가 없음');
  const opp = m.a === 0 ? m.b : m.a;
  Object.assign(m, { winner: won ? 0 : opp, sa: m.a === 0 ? score.me : score.opp, sb: m.a === 0 ? score.opp : score.me });
  const gained = won ? CUP_WIN_POINTS : 0;
  cup.gained += gained; state.statPoints += gained;
  settle(state); // 같은 라운드의 다른 경기·다음 라운드 편성. 탈락했으면 우승자까지 가린다
  return { gained, done: cup.done, place: cup.place };
}

/** 컵 종료 확인 후 슬롯 닫기: 끝난 컵을 치운다 */
export function closeCup(state) { ensureCup(state); if (state.cup?.done) state.cup = null; }

/** 화면용 대진표 */
export function cupView(state) {
  ensureCup(state);
  const cup = state.cup;
  if (!cup) return null;
  const nm = (i) => (i == null ? null : `${cup.entrants[i].name}${cup.entrants[i].me ? '' : ` (${SHORT[cup.entrants[i].league]})`}`);
  const view = (m) => ({ a: nm(m.a), b: nm(m.b), winner: m.winner == null ? null : nm(m.winner), score: m.winner == null ? null : `${m.sa}:${m.sb}`, mine: involvesMe(m) });
  return { name: cup.name, round: cup.round, roundName: ROUND_NAMES[cup.round], done: cup.done, place: cup.place, gained: cup.gained,
    rounds: ['qf', 'sf', 'final'].map((r) => ({ id: r, name: ROUND_NAMES[r], matches: cup.rounds[r].map(view) })).filter((r) => r.matches.length), leagues: LEAGUE_NAMES };
}
