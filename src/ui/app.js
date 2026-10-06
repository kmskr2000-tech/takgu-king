import { h } from './dom.js?v=1791289549';
import {
  titleScreen, rulesScreen, leagueHomeScreen, statsScreen, bracketScreen, resultScreen, matchScreen,
  equipScreen, seasonIntroScreen, seasonResultScreen, endingScreen, settingsScreen, introScreen, tutorialDoneScreen,
} from './screens.js?v=1791289549';
import {
  drawIntro, captionAt, createIntroController, INTRO_W, INTRO_H,
} from './intro.js?v=1791289549';
import { createSettings, SETTING_DEFS } from '../game/settings.js?v=1791289549';
import { createTipsStore, createTipper, tipsFor } from '../game/tips.js?v=1791289549';
import { SHOT_TYPES, DEFAULT_SHOT_TYPE, shotKeyOfSpin } from '../game/controls.js?v=1791289549';
import { describePoint, incomingLabel } from '../game/pointReason.js?v=1791289549';
import { createGameClock, ballSpeedOf } from '../game/ballspeed.js?v=1791289549';
import { DIAGRAM_FOR_STEP } from './rules.js?v=1791289549';
import { createAdManager, providerFromWindow } from '../game/ads.js?v=1791289549';
import { createTutorial, createTutorialStore, TRAINER_PARAMS, TUTORIAL_STATS } from '../game/tutorial.js?v=1791289549';
import { createAudio } from './audio.js?v=1791289549';
import { createHaptics, react } from './feedback.js?v=1791289549';
import { createRenderer } from './render.js?v=1791289549';
import { createMatchController } from '../game/matchController.js?v=1791289549';
import {
  newGame, nextMatch, aiParamsFor, effectiveStats, equip, bracketView, migrate, startNextSeason,
  applyRegularResult, applyTournamentResult, seasonGoals,
} from '../game/season.js?v=1791289549';
import { createStore } from '../game/store.js?v=1791289549';
import { createRng } from '../core/index.js?v=1791289549';


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
  // 광고 훅: 기본은 '광고 없음'(provider 없음) → 동작 변화 없음. 나중에 provider 만 꽂으면 아래 자연스러운 끊김(AD_SLOTS)에서 동작
  const ads = deps.ads ?? createAdManager({
    provider: providerFromWindow(globalThis), nowFn, storage: store.storage,
    onEvent: (e) => { if (e.type === 'start') audio.setSuspended?.(true); if (e.type === 'end') audio.setSuspended?.(false); }, // 광고 중 효과음 정지
  });
  const tutorialStore = deps.tutorialStore ?? createTutorialStore(store.storage ?? globalThis.localStorage);
  const tipsStore = deps.tipsStore ?? createTipsStore(store.storage ?? globalThis.localStorage);
  const reducedMotion = deps.reducedMotion ?? (() => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  let state = migrate(store.load());
  let loop = null; // 경기 루프 중단 플래그
  let resultToken = null;

  const mount = (el) => { while (root.firstChild) root.removeChild(root.firstChild); root.appendChild(el); };
  const persist = () => store.save(state);

  const api = {
    get state() { return state; },
    get tutorialStore() { return tutorialStore; },
    get ads() { return ads; },
    /** 앱 첫 진입: 인트로(설정이 켜져 있고 '동작 줄이기'가 아니면) → 타이틀 */
    start() {
      if (!settings.get().intro || reducedMotion()) { api.showTitle(); return; }
      api.showIntro();
    },
    showIntro() {
      const canvas = h('canvas', { class: 'intro-canvas', width: INTRO_W, height: INTRO_H });
      canvas.width = INTRO_W; canvas.height = INTRO_H;
      const ctx = canvas.getContext?.('2d');
      if (ctx) ctx.imageSmoothingEnabled = false;
      const token = {};
      loop = token;
      let onKey = null;
      const ictl = createIntroController({
        onDone: () => {
          if (onKey) globalThis.removeEventListener?.('keydown', onKey);
          if (loop === token) { loop = null; api.showTitle(); }
        },
      });
      const view = introScreen({ canvas, onSkip: () => ictl.skip() });
      mount(view.el);
      onKey = () => ictl.skip(); // 아무 키나 누르면 건너뜀
      globalThis.addEventListener?.('keydown', onKey);
      const t0 = nowFn();
      const tick = () => {
        if (loop !== token || ictl.done) return;
        const t = nowFn() - t0;
        if (ictl.update(t)) return;
        if (ctx) drawIntro(ctx, t);
        view.setCaption(captionAt(t)?.text ?? '');
        raf(tick);
      };
      tick();
    },
    showTitle() {
      loop = null;
      mount(titleScreen({
        hasSave: !!state,
        onContinue: () => api.showHome(),
        onNew: () => {
          if (state && !confirmFn('저장된 시즌이 사라집니다. 새로 시작할까요?')) return;
          state = newGame(); persist(); api.showSeasonIntro();
        },
        onTutorial: () => api.startMatch({ tutorial: true, from: 'title' }),
        onSettings: () => api.showSettings(),
        onRules: () => api.showRules(),
      }));
    },
    /** 룰 설명(그림): 카드의 도트 다이어그램이 시간에 따라 움직인다 */
    showRules() {
      const view = rulesScreen({ onBack: () => { loop = null; api.showTitle(); }, mode: settings.get().controls });
      mount(view.el);
      const token = {}; loop = token; const t0 = nowFn();
      const tick = () => { if (loop !== token) return; view.draw(nowFn() - t0); raf(tick); };
      tick();
    },
    showSettings() {
      mount(settingsScreen({
        defs: SETTING_DEFS,
        values: settings.get(),
        onToggle: (k) => { settings.cycle(k); audio.unlock(); audio.play('click'); api.showSettings(); },
        onReset: () => {
          if (!confirmFn('저장된 시즌 데이터가 모두 삭제됩니다. 설정은 유지됩니다. 삭제할까요?')) return;
          store.clear(); state = null; api.showTitle();
        },
        onBack: () => api.showTitle(),
      }));
    },
    /** 새 시즌 시작 연출(목표 안내). 새로 시작·다음 시즌에서만 보이고, 이어하기는 바로 홈 */
    showSeasonIntro() {
      loop = null;
      mount(seasonIntroScreen({ intro: seasonGoals(state), onStart: () => api.showHome() }).el);
    },
    showHome() {
      loop = null;
      mount(leagueHomeScreen({
        state,
        onPlay: () => api.showEquip(),
        onStats: () => api.showStats(),
        onBracket: () => api.showBracket(),
        onTitle: () => ads.runBreak('titleReturn', () => api.showTitle()), // 광고 훅: 홈 → 타이틀
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
      const token = {}; resultToken = token;
      ads.prepare('doublePoints'); // 광고 훅: 보상형(결과 화면에서 포인트 2배) 미리 준비
      const render = (res) => {
        const offer = !res.rewarded && !res.forfeit && ads.canOfferReward('doublePoints');
        mount(resultScreen({
          result: res,
          // 광고 훅: 경기 종료 후 — '계속'을 누르는 자연스러운 끊김 (광고가 없으면 즉시 진행)
          onNext: () => ads.runBreak('afterMatch', () => (state.phase === 'seasonEnd' ? api.showSeasonResult() : api.showHome())),
          reward: offer ? {
            label: `광고 보고 포인트 2배 (+${res.gained})`,
            onClick: async () => {
              const r = await ads.offerRewarded('doublePoints'); // 사용자가 직접 누른 클릭 안에서
              if (r.rewarded) { state.statPoints += res.gained; persist(); render({ ...res, rewarded: true }); }
            },
          } : null,
        }));
        // 보상 광고는 준비가 늦게 끝날 수 있어 잠시 뒤 한 번 더 확인
        if (!offer && !res.rewarded && !res.forfeit) later(() => { if (resultToken === token && ads.canOfferReward('doublePoints')) render(res); }, 1200);
      };
      render(result);
    },
    showTutorialDone(opts = {}) {
      loop = null;
      mount(tutorialDoneScreen({
        onPlay: () => { if (state) api.showHome(); else { state = newGame(); persist(); api.showSeasonIntro(); } },
        hasSave: !!state,
        onAgain: () => api.startMatch({ tutorial: true, from: opts.from }),
        onTitle: () => api.showTitle(),
      }));
    },
    showSeasonResult() {
      loop = null;
      const summary = state.summary;
      mount(seasonResultScreen({
        summary,
        // 광고 훅: 시즌 종료 후 — 다음 시즌으로 넘어가는 끊김
        onNext: () => ads.runBreak('seasonEnd', () => {
          if (summary.ending && state.endingPending) {
            state.endingPending = false; persist();
            mount(endingScreen({ onNext: () => { startNextSeason(state); persist(); api.showSeasonIntro(); } }));
          } else { startNextSeason(state); persist(); api.showSeasonIntro(); }
        }),
      }));
    },
    /** opts.tutorial: 코치와 하는 체험형 튜토리얼 (기록·포인트·광고·포기 페널티 없음) */
    startMatch(opts = {}) {
      const tut = opts.tutorial ? (opts.tutInstance ?? createTutorial({ mode: settings.get().controls })) : null;
      const nm = tut ? { opp: { name: '코치', style: 'balanced', rival: false }, stage: 'tutorial' } : nextMatch(state);
      if (!nm) { api.showHome(); return; }
      const { opp, stage } = nm;
      const startedAt = nowFn(); // 포기 판정은 실시간 기준
      const clock = createGameClock(nowFn, tut ? 0.6 : ballSpeedOf(settings.get().ballSpeed).scale); // 공 속도(튜토리얼은 더 느리게): 게임 시계 배율(경기 중 고정)
      api.gameClock = clock;
      const mode = settings.get().controls; // 조작 방식은 경기 시작 시점 값으로 고정
      let lastMiss = null;
      let shotType = DEFAULT_SHOT_TYPE; // 간단 조작: 마지막으로 고른 샷 종류가 유지된다
      const canvas = h('canvas', { class: 'court' });
      const view = matchScreen({
        oppName: opp.name,
        oppStyle: tut ? '연습 상대' : opp.style === 'cut' ? '커트 위주' : '올라운더',
        canvas,
        quitLabel: tut ? '나가기' : '포기',
        onShot: (k) => { shotType = k; view.setShot(k); audio.unlock(); audio.play('click'); },
        onQuit: () => {
          if (tut) { loop = null; api.showTitle(); return; } // 튜토리얼은 언제든 페널티 없이 나감
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
          persist(); ads.noteMatchPlayed();
          react({ type: 'end', winner: 'opp' }, { audio, haptics });
          api.showResult({ won: false, score, gained, forfeit: true });
        },
      });
      mount(view.el);
      view.setShotBar(mode === 'simple'); view.setShot(shotType);
      const renderer = createRenderer(canvas, { options: () => settings.get() });
      renderer.setControlMode(mode);
      audio.unlock(); // 경기 시작 클릭(사용자 제스처) 안에서 오디오 허용
      renderer.setOpponentLook(opp.rival ? 'rival' : 'opp');
      const seed = (Date.now() & 0xffffffff) >>> 0;
      const ctl = createMatchController({
        stats: tut ? TUTORIAL_STATS : effectiveStats(state),
        oppParams: tut ? TRAINER_PARAMS : aiParamsFor(state, opp),
        rng: createRng(seed),
        difficulty: tut ? 'tutorial' : settings.get().difficulty, // 경기 시작 시점의 난이도 (경기 중 고정)
        controlMode: mode, getShotType: () => shotType, useMatchup: !tut, // 튜토리얼은 상성 없이 기본기부터
        courtWidth: canvas.clientWidth || 300,
        onEvent: (e) => {
          renderer.notify(e, clock());
          react(e, { audio, haptics });
          if (e.type === 'grade') {
            const mu = e.matchup === 'win' ? ' · 상성 유리!' : e.matchup === 'lose' ? ' · 상성 불리…' : '';
            view.setJudge((e.grade === 'MISS' ? '미스!' : e.grade === 'PERFECT' ? '퍼펙트!' : '굿') + (e.grade === 'MISS' ? '' : mu));
          }
          if (e.type === 'missed') lastMiss = e; // 직전 타이밍 실수(일찍/늦게/무탭): 실점 원인 표시에 쓴다
          if (e.type === 'point') {
            view.setScore(e.score.me, e.score.opp, null);
            view.flashScore(e.winner);
            view.setJudge('');
            view.setPoint(describePoint(e, lastMiss)); lastMiss = null;
          }
          if (tut) { // 튜토리얼: 단계 진행·코치 패널 갱신. 결과는 기록하지 않는다
            if (['serve', 'return', 'missed', 'point'].includes(e.type)) {
              const r = tut.handle(e);
              view.setCoach(r.view); view.setShotHint(r.view.hint.button ?? null); view.setCoachDiagram(DIAGRAM_FOR_STEP[r.view.id] ?? null); // 눌러야 할 샷 버튼 반짝 + 설명 그림
              if (r.completed) {
                tutorialStore.complete();
                later(() => { if (loop === token) api.showTutorialDone(opts); }, 1500);
              }
            }
            if (e.type === 'end' && !tut.completed) later(() => { if (loop === token) api.startMatch({ ...opts, tutInstance: tut }); }, 1200); // 경기가 끝나 버리면 같은 진행으로 새 경기
            return;
          }
          if (e.type === 'end') {
            const won = e.winner === 'me';
            // 결과 반영은 경기당 정확히 1회 (end 이벤트는 1회만 발생)
            const rng = createRng((Date.now() ^ (state.week * 7919)) >>> 0);
            const { gained } = stage === 'tournament'
              ? applyTournamentResult(state, { won, score: e.score }, rng)
              : applyRegularResult(state, { won, score: e.score }, rng);
            persist(); ads.noteMatchPlayed();
            later(() => { if (loop === token) api.showResult({ won, score: e.score, gained }); }, 800);
          }
        },
      });
      const tipper = createTipper({ store: tipsStore, enabled: () => !tut && settings.get().tips, tips: tipsFor(mode) });
      if (tut) { view.setCoach(tut.view); view.setShotHint(tut.view.hint.button ?? null); view.setCoachDiagram(DIAGRAM_FOR_STEP[tut.view.id] ?? null); } // 첫 단계 안내
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
        tipper.acted(); // 힌트가 알려준 행동을 했으니 본 것으로 확정
        if (activeId !== null) return;
        activeId = ev.pointerId ?? 0;
        canvas.setPointerCapture?.(ev.pointerId); // 캔버스 밖으로 나가도 up 수신
        const [x, y] = toLocal(ev); ctl.pointerDown(clock(), x, y);
      });
      canvas.addEventListener('pointermove', (ev) => {
        if (activeId === null || (ev.pointerId ?? 0) !== activeId) return;
        const [x, y] = toLocal(ev); ctl.pointerMove(clock(), x, y); // 고급 조작: 쓸기 위치 추적
      });
      canvas.addEventListener('pointerup', (ev) => {
        if (activeId === null || (ev.pointerId ?? 0) !== activeId) return;
        activeId = null;
        const [x, y] = toLocal(ev); ctl.pointerUp(clock(), x, y);
      });
      canvas.addEventListener('contextmenu', (ev) => ev.preventDefault?.()); // 길게 누르기 메뉴 차단
      canvas.addEventListener('pointercancel', (ev) => {
        if (activeId === null || (ev.pointerId ?? 0) !== activeId) return;
        activeId = null;
        ctl.pointerCancel(clock());
      });
      ctl.start(clock());
      let wasServing = false; let shownServer = null;
      const tick = () => {
        if (loop !== token) return;
        const now = clock();
        ctl.update(now);
        if (tut) view.drawCoachDiagram(nowFn(), mode); // 튜토리얼 설명 그림(움직임)
        renderer.setHint(tut ? tut.view.hint : null); // 레인·화살표 안내(튜토리얼 단계별)
        renderer.draw(ctl, now);
        view.setScore(ctl.match.score.me, ctl.match.score.opp, ctl.match.server);
        const serving = ctl.phase === 'awaitServe' || ctl.phase === 'oppServeWait';
        if (serving && !wasServing) { view.flashServe(ctl.match.server); view.setPoint(null); } // 다음 서브가 시작되면 득점/실점 배너를 치운다
        if (serving && !wasServing) view.setJudge(''); // 서브 차례가 시작되는 순간 크게 알림
        wasServing = serving;
        if (ctl.match.server !== shownServer) { shownServer = ctl.match.server; view.setServe(shownServer); }
        const situation = ctl.phase === 'awaitServe' ? 'awaitServe' : (ctl.phase === 'flight' && ctl.timing && !ctl.pendingDown ? 'incoming' : null);
        // 간단 조작: 날아오는 공의 종류 칩 (이걸 보고 상성에 맞는 샷을 고른다). 튜토리얼에서는 숨김
        const inKey = mode === 'simple' && !tut && situation === 'incoming' && ctl.flight ? shotKeyOfSpin(ctl.flight.spin) : null;
        view.setIncoming(inKey ? incomingLabel(inKey) : '', inKey);
        view.setTip(tipper.update(situation, now, ctl.t0)?.text ?? '');
        raf(tick);
      };
      raf(tick);
      api.controller = ctl;
    },
  };
  return api;
}
