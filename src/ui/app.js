import { h } from './dom.js?v=1791275435';
import {
  titleScreen, rulesScreen, leagueHomeScreen, statsScreen, bracketScreen, resultScreen, matchScreen,
  equipScreen, seasonResultScreen, endingScreen, settingsScreen,
} from './screens.js?v=1791275435';
import { createSettings, SETTING_DEFS } from '../game/settings.js?v=1791275435';
import { createAudio } from './audio.js?v=1791275435';
import { createHaptics, react } from './feedback.js?v=1791275435';
import { createRenderer } from './render.js?v=1791275435';
import { createMatchController } from '../game/matchController.js?v=1791275435';
import {
  newGame, nextMatch, aiParamsFor, effectiveStats, equip, bracketView, migrate, startNextSeason,
  applyRegularResult, applyTournamentResult,
} from '../game/season.js?v=1791275435';
import { createStore } from '../game/store.js?v=1791275435';
import { createRng } from '../core/index.js?v=1791275435';


/** 앱 부트스트랩. root: 마운트 요소, deps: 테스트 주입용 { store, raf, nowFn } */
export const FORFEIT_AFTER = 120; // 경기 시작 후 이 시간(초) 이상 지나 포기하면 기권패

export function createApp(root, deps = {}) {
  const store = deps.store ?? createStore();
  const raf = deps.raf ?? ((fn) => globalThis.requestAnimationFrame(fn));
  const nowFn = deps.nowFn ?? (() => performance.now() / 1000);
  const confirmFn = deps.confirm ?? ((msg) => (globalThis.confirm ? globalThis.confirm(msg) : true));
  const later = deps.later ?? ((fn, ms) => setTimeout(fn, ms));
  const settings = deps.settings ?? createSettings(deps.settingsStorage ?? store.storage ?? globalThis.localStorage);
  const audio = deps.audio ?? createAudio({ enabled: () => settings.get().sound });
  const haptics = deps.haptics ?? createHaptics({ enabled: () => settings.get().vibration });
  let state = migrate(store.load());
  let loop = null; // 경기 루프 중단 플래그

  const mount = (el) => { while (root.firstChild) root.removeChild(root.firstChild); root.appendChild(el); };
  const persist = () => store.save(state);

  const api = {
    get state() { return state; },
    showTitle() {
      loop = null;
      mount(titleScreen({
        hasSave: !!state,
        onContinue: () => api.showHome(),
        onNew: () => {
          if (state && !confirmFn('저장된 시즌이 사라집니다. 새로 시작할까요?')) return;
          state = newGame(); persist(); api.showHome();
        },
        onSettings: () => api.showSettings(),
        onRules: () => mount(rulesScreen({ onBack: () => api.showTitle() })),
      }));
    },
    showSettings() {
      mount(settingsScreen({
        defs: SETTING_DEFS,
        values: settings.get(),
        onToggle: (k) => { settings.toggle(k); audio.unlock(); audio.play('click'); api.showSettings(); },
        onReset: () => {
          if (!confirmFn('저장된 시즌 데이터가 모두 삭제됩니다. 설정은 유지됩니다. 삭제할까요?')) return;
          store.clear(); state = null; api.showTitle();
        },
        onBack: () => api.showTitle(),
      }));
    },
    showHome() {
      loop = null;
      mount(leagueHomeScreen({
        state,
        onPlay: () => api.showEquip(),
        onStats: () => api.showStats(),
        onBracket: () => api.showBracket(),
        onTitle: () => api.showTitle(),
        onSeasonEnd: () => api.showSeasonResult(),
      }));
    },
    showStats() {
      mount(statsScreen({
        state,
        onInvest: (k) => { if (state.statPoints > 0) { state.stats[k] += 1; state.statPoints -= 1; persist(); } api.showStats(); },
        onBack: () => api.showHome(),
      }));
    },
    showBracket() {
      mount(bracketScreen({ bracket: bracketView(state), onBack: () => api.showHome() }));
    },
    showEquip() {
      mount(equipScreen({
        state,
        onChange: (kind, id) => {
          equip(state, kind === 'grip' ? id : state.grip, kind === 'racket' ? id : state.racket);
          persist(); api.showEquip();
        },
        onStart: () => api.startMatch(),
        onBack: () => api.showHome(),
      }));
    },
    showResult(result) {
      loop = null;
      mount(resultScreen({ result, onNext: () => (state.phase === 'seasonEnd' ? api.showSeasonResult() : api.showHome()) }));
    },
    showSeasonResult() {
      loop = null;
      const summary = state.summary;
      mount(seasonResultScreen({
        summary,
        onNext: () => {
          if (summary.ending && state.endingPending) {
            state.endingPending = false; persist();
            mount(endingScreen({ onNext: () => { startNextSeason(state); persist(); api.showHome(); } }));
          } else { startNextSeason(state); persist(); api.showHome(); }
        },
      }));
    },
    startMatch() {
      const nm = nextMatch(state);
      if (!nm) { api.showHome(); return; }
      const { opp, stage } = nm;
      const startedAt = nowFn();
      const canvas = h('canvas', { class: 'court' });
      const view = matchScreen({
        oppName: opp.name,
        oppStyle: opp.style === 'cut' ? '커트 위주' : '올라운더',
        canvas,
        onQuit: () => {
          const ctl2 = api.controller;
          const elapsed = nowFn() - startedAt;
          if (!ctl2 || ctl2.phase === 'over' || elapsed < FORFEIT_AFTER) { loop = null; api.showHome(); return; } // 2분 이내: 기록 없이 취소
          if (!confirmFn('지금 포기하면 기권패로 기록됩니다. 포기할까요?')) return;
          loop = null;
          const sc = ctl2.match.score;
          const score = { me: sc.me, opp: Math.max(sc.opp, 11) }; // 기권패: 상대 11점 처리
          const rng = createRng((Date.now() ^ (state.week * 104729)) >>> 0);
          const { gained } = stage === 'tournament'
            ? applyTournamentResult(state, { won: false, score }, rng)
            : applyRegularResult(state, { won: false, score }, rng);
          persist();
          react({ type: 'end', winner: 'opp' }, { audio, haptics });
          api.showResult({ won: false, score, gained, forfeit: true });
        },
      });
      mount(view.el);
      const renderer = createRenderer(canvas, { options: () => settings.get() });
      audio.unlock(); // 경기 시작 클릭(사용자 제스처) 안에서 오디오 허용
      renderer.setOpponentLook(opp.rival ? 'rival' : 'opp');
      const seed = (Date.now() & 0xffffffff) >>> 0;
      const ctl = createMatchController({
        stats: effectiveStats(state),
        oppParams: aiParamsFor(state, opp),
        rng: createRng(seed),
        courtWidth: canvas.clientWidth || 300,
        onEvent: (e) => {
          renderer.notify(e, nowFn());
          react(e, { audio, haptics });
          if (e.type === 'grade') view.setJudge(e.grade === 'MISS' ? '미스!' : e.grade === 'PERFECT' ? '퍼펙트!' : '굿');
          if (e.type === 'point') {
            view.setScore(e.score.me, e.score.opp, null);
            view.setJudge(e.winner === 'me' ? '득점!' : '실점…');
          }
          if (e.type === 'end') {
            const won = e.winner === 'me';
            // 결과 반영은 경기당 정확히 1회 (end 이벤트는 1회만 발생)
            const rng = createRng((Date.now() ^ (state.week * 7919)) >>> 0);
            const { gained } = stage === 'tournament'
              ? applyTournamentResult(state, { won, score: e.score }, rng)
              : applyRegularResult(state, { won, score: e.score }, rng);
            persist();
            later(() => { if (loop === token) api.showResult({ won, score: e.score, gained }); }, 800);
          }
        },
      });
      const token = {};
      loop = token;
      const toLocal = (ev) => {
        const r = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 };
        return [ev.clientX - r.left, ev.clientY - r.top];
      };
      let activeId = null; // 첫 포인터만 인정 (멀티터치/다른 손가락 up 무시)
      canvas.addEventListener('pointerdown', (ev) => {
        ev.preventDefault?.();
        audio.unlock();
        if (activeId !== null) return;
        activeId = ev.pointerId ?? 0;
        canvas.setPointerCapture?.(ev.pointerId); // 캔버스 밖으로 나가도 up 수신
        const [x, y] = toLocal(ev); ctl.pointerDown(nowFn(), x, y);
      });
      canvas.addEventListener('pointerup', (ev) => {
        if (activeId === null || (ev.pointerId ?? 0) !== activeId) return;
        activeId = null;
        const [x, y] = toLocal(ev); ctl.pointerUp(nowFn(), x, y);
      });
      canvas.addEventListener('contextmenu', (ev) => ev.preventDefault?.()); // 길게 누르기 메뉴 차단
      canvas.addEventListener('pointercancel', (ev) => {
        if (activeId === null || (ev.pointerId ?? 0) !== activeId) return;
        activeId = null;
        ctl.pointerCancel(nowFn());
      });
      ctl.start(nowFn());
      const tick = () => {
        if (loop !== token) return;
        const now = nowFn();
        ctl.update(now);
        renderer.draw(ctl, now);
        view.setScore(ctl.match.score.me, ctl.match.score.opp, ctl.match.server);
        raf(tick);
      };
      raf(tick);
      api.controller = ctl;
    },
  };
  return api;
}
