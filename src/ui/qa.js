// QA 직접 링크(#qa-match / #qa-tutorial / #qa-home / #qa-season-intro / #qa-result): 레이아웃 점검용으로 "정지 화면"을 만든다.
// 안전: 실제 저장소(localStorage)를 절대 읽거나 쓰지 않는다 — 메모리 저장소 + 고정 시드 + 수동 시계. 인트로·소리 없음.
import { createApp } from './app.js?v=1791366989';
import { createStore } from '../game/store.js?v=1791366989';
import { newGame } from '../game/season.js?v=1791366989';
import { describePoint } from '../game/pointReason.js?v=1791366989';

export const QA_ROUTES = Object.freeze(['match', 'tutorial', 'home', 'season-intro', 'result']);

function memoryStorage() {
  const d = {};
  return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } };
}

/** root 에 route 화면을 만들고 { app, step } 을 돌려준다. step(n): n 프레임 진행 (자동 루프 없음 → 화면이 고정된다) */
export function mountQa(root, route, { seed = 12345 } = {}) {
  const storage = memoryStorage();
  const store = createStore(storage);
  if (route !== 'title') store.save(newGame()); // 항상 새 시즌 상태에서 시작
  const frames = []; let t = 0;
  const silent = { unlock: () => false, play: () => false, setSuspended() {}, onUnlock() {}, get context() { return null; } };
  const noBgm = { play: () => false, sync() {}, stop() {}, setSuspended() {} };
  const app = createApp(root, { firstGuide: false, story: false,
    store, raf: (fn) => frames.push(fn), nowFn: () => t, later: () => {}, confirm: () => true,
    audio: silent, bgm: noBgm, reducedMotion: () => true, seed,
  });
  const step = (n = 1) => { for (let i = 0; i < n; i++) { t += 1 / 60; frames.splice(0).forEach((fn) => fn()); } };

  if (route === 'home') app.showHome();
  else if (route === 'season-intro') app.showSeasonIntro();
  else if (route === 'result') app.showResult({ won: false, score: { me: 7, opp: 11 }, gained: 1 });
  else if (route === 'tutorial') { app.startMatch({ tutorial: true, from: 'title' }); step(3); }
  else if (route === 'match') {
    app.startMatch(); step(2);
    const ctl = app.controller;
    // 서브를 치고 상대의 공이 날아올 때까지 진행 → 공 종류 칩·코스 라벨·득점/실점 배너를 한 화면에 (가장 붐비는 장면)
    for (let i = 0; i < 60 * 120 && !(ctl.phase === 'flight' && ctl.timing && ctl.flight?.dir > 0); i++) {
      if (ctl.phase === 'awaitServe') ctl.swing(app.gameClock(), 'normal');
      step(1);
    }
    ctl.setLane(270); step(2);
    app.matchView?.setPoint(describePoint({ winner: 'opp', reason: 'miss', myShotType: null }, { reason: 'late' }));
    app.matchView?.flashScore('opp'); step(1);
  } else return null;
  return { app, step };
}
