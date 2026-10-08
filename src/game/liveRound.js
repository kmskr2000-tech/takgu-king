// 리그전 속보: 내 경기가 진행되는 동안 같은 라운드의 다른 경기(AI 끼리)가 '실시간으로' 흘러간다.
// 시작 시점에 결과(승자·점수)와 득점 순서·시각을 미리 정해 두고(planLiveRound), 경기 시계에 맞춰 보여준다(createLiveTicker).
// 결과는 preset 으로 applyRegularResult 에 넘겨 순위표에 그대로 반영 → 화면에서 본 점수와 최종 기록이 어긋나지 않는다.
import { quickPlay } from './season.js?v=1791434034';

export const LIVE_PACE = Object.freeze({ min: 6, max: 13 }); // 한 점당 평균 초 (경기마다 템포가 다르고 점마다 ±40% 흔들림)
export const ROTATE_EVERY = 2.6; // 득점이 없으면 이 초마다 다음 경기로 넘어간다

const shuffle = (arr, rng) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

/** 정규 리그 라운드의 다른 경기들: { games: [{ key,a,b,aName,bName,seq,times,ca,cb }], preset: { 'a-b': {winner,sa,sb} } } */
export function planLiveRound(state, rng, pace = LIVE_PACE) {
  if (state.phase !== 'regular') return { games: [], preset: {} };
  const games = []; const preset = {};
  for (const [a, b] of state.schedule[state.week - 1]) {
    if (a === 0 || b === 0) continue;
    const r = quickPlay(state, a, b, rng);
    const w = r.winner === a ? 0 : 1; // seq 원소: 0 = a 득점, 1 = b 득점
    const loserPts = r.winner === a ? r.sb : r.sa;
    const seq = shuffle([...Array(10).fill(w), ...Array(loserPts).fill(1 - w)], rng); seq.push(w); // 승자의 11점째가 마지막 점
    const tempo = pace.min + rng.next() * (pace.max - pace.min);
    let t = 1 + rng.next() * 4; // 경기마다 시작 시차
    const times = seq.map(() => { t += tempo * (0.6 + 0.8 * rng.next()); return t; });
    let x = 0; let y = 0; const ca = [0]; const cb = [0];
    for (const s of seq) { if (s === 0) x++; else y++; ca.push(x); cb.push(y); }
    const key = `${a}-${b}`;
    preset[key] = { winner: r.winner, sa: r.sa, sb: r.sb };
    games.push({ key, a, b, aName: state.teams[a].name, bName: state.teams[b].name, seq, times, ca, cb });
  }
  return { games, preset };
}

/** 경과 t 초 시점의 한 경기: { n(진행된 점수 수), sa, sb, done, last(마지막 득점자 0|1|null) } */
export function scoreAt(g, t) {
  let n = 0; while (n < g.times.length && g.times[n] <= t) n++;
  return { n, sa: g.ca[n], sb: g.cb[n], done: n === g.seq.length, last: n ? g.seq[n - 1] : null };
}

/**
 * 한 줄 상황판 컨트롤러. update(t) → 화면에 바꿀 내용({aName,sa,sb,bName,done,flash,index,total}) 또는 변화 없으면 null.
 * 득점이 나면 그 경기로 즉시 넘어가 득점한 쪽을 강조(flash)하고, 아니면 일정 간격으로 다음 경기를 돌려 보여준다.
 */
export function createLiveTicker(games, { rotate = ROTATE_EVERY } = {}) {
  const seen = games.map(() => 0); let cur = 0; let since = 0; let flash = null; let lastKey = '';
  return {
    update(t) {
      if (!games.length) return null;
      let scored = -1;
      games.forEach((g, i) => { const s = scoreAt(g, t); if (s.n > seen[i]) { scored = i; flash = s.last === 0 ? 'a' : 'b'; } seen[i] = s.n; });
      if (scored >= 0) { cur = scored; since = t; }
      else if (t - since >= rotate) { cur = (cur + 1) % games.length; since = t; flash = null; }
      const g = games[cur]; const s = scoreAt(g, t);
      const v = { aName: g.aName, bName: g.bName, sa: s.sa, sb: s.sb, done: s.done, flash, index: cur + 1, total: games.length };
      const key = JSON.stringify(v);
      if (key === lastKey) return null;
      lastKey = key; return v;
    },
  };
}
