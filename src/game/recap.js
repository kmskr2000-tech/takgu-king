// 경기 후 상황 정리판(FM 식): 이번 라운드 내 경기 + 다른 경기 결과 + 순위 변동. 순수 데이터.
import { ranking } from './season.js?v=1791436882';

/** 정규 경기 결과를 반영하기 직전에 부른다: { before: 순위표, n: 로그 길이 } */
export const snapshotBefore = (state) => ({ before: ranking(state), n: state.log.length });

/** 반영 직후에 부른다. before 는 snapshotBefore 의 반환값. 반환: { round, games, rows } */
export function buildRecap(state, snap, round) {
  const nm = (id) => state.teams[id].name;
  const games = state.log.slice(snap.n).filter((g) => g.stage === 'regular').map((g) => ({
    a: g.a, b: g.b, aName: nm(g.a), bName: nm(g.b), sa: g.sa, sb: g.sb, winner: g.winner, mine: g.a === 0 || g.b === 0,
  })).sort((x, y) => Number(y.mine) - Number(x.mine)); // 내 경기가 맨 위
  const prev = new Map(snap.before.map((t) => [t.id, t.rank]));
  const rows = ranking(state).map((t) => ({
    id: t.id, name: t.name, rank: t.rank, prev: prev.get(t.id), delta: prev.get(t.id) - t.rank,
    points: t.points, wins: t.wins, losses: t.losses, me: !!t.me, rival: !!t.rival,
  }));
  return { round, games, rows };
}
