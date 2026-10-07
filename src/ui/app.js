import { h } from './dom.js?v=1791361346';
import {
  titleScreen, rulesScreen, leagueHomeScreen, statsScreen, bracketScreen, resultScreen, matchScreen,
  equipScreen, seasonIntroScreen, seasonResultScreen, endingScreen, settingsScreen, introScreen, tutorialDoneScreen, rivalCardScreen, storyBeatScreen, storyIntroScreen,
  multiScreen, netResultScreen,
} from './screens.js?v=1791361346';
import { createNetSession } from '../net/session.js?v=1791361346';
import { createNetClock } from '../net/clock.js?v=1791361346';
import { FirebaseRoom } from '../net/fireroom.js?v=1791361346';
import {
  drawIntro, captionAt, createIntroController, INTRO_W, INTRO_H,
} from './intro.js?v=1791361346';
import { drawStoryIntro, captionAt as storyCaptionAt, createStoryIntro, INTRO_W as SI_W, INTRO_H as SI_H } from './storyIntro.js?v=1791361346';
import { createSettings, SETTING_DEFS } from '../game/settings.js?v=1791361346';
import { createTipsStore, createTipper, tipsFor } from '../game/tips.js?v=1791361346';
import { createGuideStore, createFirstGuide, GUIDE_COVERS } from '../game/firstGuide.js?v=1791361346';
import { introBeat, pendingBeat, clearBeat, markBeat, rivalPreMatch, rivalPostMatch, beatOf } from '../game/story.js?v=1791361346';
import { SHOT_TYPES, shotKeyOfSpin, counterOf, HINT_MATCHES } from '../game/controls.js?v=1791361346';
import { applyGameLevel, gameLevelOf } from '../game/gamelevel.js?v=1791361346';
import { describePoint, incomingLabel } from '../game/pointReason.js?v=1791361346';
import { oppProfile } from '../game/oppProfile.js?v=1791361346';
import { createGameClock, ballSpeedOf } from '../game/ballspeed.js?v=1791361346';
import { DIAGRAM_FOR_STEP } from './rules.js?v=1791361346';
import { createAdManager, providerFromWindow } from '../game/ads.js?v=1791361346';
import { createTutorial, createTutorialStore, TRAINER_PARAMS, TUTORIAL_STATS } from '../game/tutorial.js?v=1791361346';
import { createAudio } from './audio.js?v=1791361346';
import { createBgm } from './bgm.js?v=1791361346';
import { createHaptics, react } from './feedback.js?v=1791361346';
import { createRenderer } from './render.js?v=1791361346';
import { createMatchController } from '../game/matchController.js?v=1791361346';
import {
  newGame, nextMatch, aiParamsFor, effectiveStats, equip, bracketView, migrate, startNextSeason,
  applyRegularResult, applyTournamentResult, seasonGoals,
} from '../game/season.js?v=1791361346';
import { createStore } from '../game/store.js?v=1791361346';
import { createRng } from '../core/index.js?v=1791361346';


/** 앱 부트스트랩. root: 마운트 요소, deps: 테스트 주입용 { store, raf, nowFn } */
export const FORFEIT_AFTER = 120;
/** 멀티플레이: 두 사람이 같은 조건 — 능력치·판정 범위·공 속도를 고정한다 (기록·포인트·시즌과 무관) */
export const NET_STATS = Object.freeze({ power: 7, spin: 7, focus: 7 });
export const NET_DIFFICULTY = 'normal';
export const NET_BALL_SCALE = 0.8; // 경기 시작 후 이 시간(초) 이상 지나 포기하면 기권패

export function createApp(root, deps = {}) {
  const store = deps.store ?? createStore();
  const raf = deps.raf ?? ((fn) => globalThis.requestAnimationFrame(fn));
  const nowFn = deps.nowFn ?? (() => performance.now() / 1000);
  const confirmFn = deps.confirm ?? ((msg) => (globalThis.confirm ? globalThis.confirm(msg) : true));
  const later = deps.later ?? ((fn, ms) => setTimeout(fn, ms));
  const settings = deps.settings ?? createSettings(deps.settingsStorage ?? store.storage ?? globalThis.localStorage);
  const audio = deps.audio ?? createAudio({ enabled: () => settings.get().sound });
  // 배경음악: 사운드·배경음악 설정이 모두 켜져 있을 때만. 오디오는 사용자 제스처 뒤에 열리므로 열리는 순간 이어서 시작한다
  const bgm = deps.bgm ?? createBgm({ getCtx: () => audio.context ?? null, enabled: () => settings.get().sound && settings.get().bgm });
  audio.onUnlock?.(() => bgm.sync());
  globalThis.document?.addEventListener?.('visibilitychange', () => bgm.setSuspended(!!globalThis.document.hidden)); // 백그라운드 탭에서는 멈춤
  const haptics = deps.haptics ?? createHaptics({ enabled: () => settings.get().vibration });
  // 광고 훅: 기본은 '광고 없음'(provider 없음) → 동작 변화 없음. 나중에 provider 만 꽂으면 아래 자연스러운 끊김(AD_SLOTS)에서 동작
  const ads = deps.ads ?? createAdManager({
    provider: providerFromWindow(globalThis), nowFn, storage: store.storage,
    onEvent: (e) => { if (e.type === 'start') { audio.setSuspended?.(true); bgm.setSuspended(true); } if (e.type === 'end') { audio.setSuspended?.(false); bgm.setSuspended(false); } }, // 광고 중 효과음·배경음악 정지
  });
  const tutorialStore = deps.tutorialStore ?? createTutorialStore(store.storage ?? globalThis.localStorage);
  const tipsStore = deps.tipsStore ?? createTipsStore(store.storage ?? globalThis.localStorage);
  const storyOn = () => deps.story !== false; // 스토리 컷(라이벌 대사·시즌 비트). 테스트는 끌 수 있다
  const guideStore = deps.guideStore ?? createGuideStore(store.storage ?? globalThis.localStorage);
  const reducedMotion = deps.reducedMotion ?? (() => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  let state = migrate(store.load());
  let loop = null; // 경기 루프 중단 플래그
  let resultToken = null;

  // 화면 전환 때 스크롤을 맨 위로: 이전 화면(긴 홈 등)에서 내려온 스크롤이 남으면 새 화면의 윗부분(점수판·제목)이 잘려 보인다
  const toTop = () => { try { globalThis.scrollTo?.(0, 0); const d = globalThis.document; if (d?.documentElement) d.documentElement.scrollTop = 0; if (d?.body) d.body.scrollTop = 0; } catch { /* 무시 */ } };
  const mount = (el) => { while (root.firstChild) root.removeChild(root.firstChild); root.appendChild(el); toTop(); };
  const persist = () => store.save(state);
  // 새 게임·데이터 삭제: '첫 경기' 안내(평생 한 번 저장)와 일반 힌트의 본 기록도 처음으로 — 한 번 본 기기에서 새로 시작해도 첫 경기에 안내가 다시 나온다
  const resetGuides = () => { guideStore.clear(); tipsStore.clear(); };

  const api = {
    get state() { return state; },
    get tutorialStore() { return tutorialStore; },
    get ads() { return ads; },
    get bgm() { return bgm; },
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
    /** 새 게임 시작 전 도민구 소개 컷신(스토리·인트로 연출 설정이 켜져 있고 '동작 줄이기'가 아닐 때만). 탭=다음 줄, 건너뛰기=전부. 끝나면 onDone */
    showStoryIntro(onDone) {
      if (!storyOn() || !settings.get().intro || reducedMotion()) { onDone(); return; }
      const canvas = h('canvas', { class: 'intro-canvas', width: SI_W, height: SI_H });
      canvas.width = SI_W; canvas.height = SI_H;
      const ctx = canvas.getContext?.('2d');
      if (ctx) ctx.imageSmoothingEnabled = false;
      const token = {}; loop = token;
      const sctl = createStoryIntro({ onDone: () => { if (loop === token) { loop = null; onDone(); } } });
      const view = storyIntroScreen({ canvas, onAdvance: () => { audio.unlock(); sctl.advance(); }, onSkip: () => sctl.skip() });
      mount(view.el); bgm.play('title');
      let last = nowFn();
      const tick = () => {
        if (loop !== token || sctl.done) return;
        const n = nowFn(); if (sctl.tick(n - last)) return; last = n;
        if (ctx) drawStoryIntro(ctx, sctl.t);
        view.setCaption(storyCaptionAt(sctl.t));
        raf(tick);
      };
      tick();
    },
    showTitle() {
      loop = null; bgm.play('title');
      mount(titleScreen({
        hasSave: !!state,
        onContinue: () => api.showHome(),
        onNew: () => {
          if (state && !confirmFn('저장된 시즌이 사라집니다. 새로 시작할까요?')) return;
          state = newGame(); persist(); resetGuides(); api.showStoryIntro(() => api.showSeasonIntro());
        },
        onTutorial: () => api.startMatch({ tutorial: true, from: 'title' }),
        onMulti: () => api.showMultiplayer(),
        onSettings: () => api.showSettings(),
        onRules: () => api.showRules(),
        level: gameLevelOf(settings.get().gameLevel),
        onLevel: () => { settings.cycle('gameLevel'); api.showTitle(); },
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
        onToggle: (k) => { settings.cycle(k); audio.unlock(); bgm.sync(); audio.play('click'); api.showSettings(); },
        onReset: () => {
          if (!confirmFn('저장된 시즌 데이터가 모두 삭제됩니다. 설정은 유지됩니다. 삭제할까요?')) return;
          store.clear(); resetGuides(); state = null; api.showTitle();
        },
        onBack: () => api.showTitle(),
      }));
    },
    /** 새 시즌 시작 연출(목표 안내). 새로 시작·다음 시즌에서만 보이고, 이어하기는 바로 홈 */
    showSeasonIntro() {
      loop = null;
      const story = storyOn() ? introBeat(state) : null; // 이 리그에서 처음일 때만 도입 컷
      mount(seasonIntroScreen({ intro: seasonGoals(state), onStart: () => api.showHome(), story }).el);
      if (story) { markBeat(state, 'intro'); persist(); }
    },
    showHome() {
      loop = null; bgm.play('title');
      const beat = storyOn() && state ? pendingBeat(state) : null; // 주차가 되면 스토리 컷(연패·중반·관계·결승)을 한 장씩 보여 주고 홈으로
      if (beat) { mount(storyBeatScreen({ beat, onNext: () => { markBeat(state, beat.id); persist(); api.showHome(); } })); return; }
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
        onStart: () => api.beforeMatch(),
        onBack: () => api.showHome(),
      }));
    },
    /** 경기 시작 직전: 라이벌전이면 라이벌 소개·대사 컷(처음엔 '첫 등장' 대사까지)을 보여 주고 경기 화면으로 */
    beforeMatch() {
      const nm = storyOn() && state ? nextMatch(state) : null;
      const pre = nm ? rivalPreMatch(state, nm.opp) : null;
      if (!pre) { api.startMatch(); return; }
      persist();
      mount(rivalCardScreen({ rival: pre.rival, lines: pre.lines, first: pre.first, onStart: () => api.startMatch() }));
    },
    showResult(result) {
      loop = null; bgm.play('title');
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
        hasSave: !!state, mode: settings.get().controls,
        onAgain: () => api.startMatch({ tutorial: true, from: opts.from }),
        onTitle: () => api.showTitle(),
      }));
    },
    showSeasonResult() {
      loop = null;
      const summary = state.summary;
      const story = storyOn() && summary.champion && !summary.ending ? clearBeat(state, summary.league) : null; // 우승 직후 스토리 컷 (세계대회 우승은 엔딩 화면이 맡는다)
      if (story) { markBeat(state, 'clear', summary.league); persist(); }
      mount(seasonResultScreen({
        summary, story,
        // 광고 훅: 시즌 종료 후 — 다음 시즌으로 넘어가는 끊김
        onNext: () => ads.runBreak('seasonEnd', () => {
          if (summary.ending && state.endingPending) {
            state.endingPending = false; persist();
            if (storyOn()) markBeat(state, 'clear', summary.league);
            mount(endingScreen({ story: storyOn() ? beatOf('world', 'clear') : null, onNext: () => { startNextSeason(state); persist(); api.showSeasonIntro(); } }));
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
      // 첫 경기 안내(튜토리얼 제외, 평생 한 번): 중요한 순간마다 경기를 멈추고 설명한다. 안내가 남은 경기에선 일반 힌트(tips)를 대신한다
      const guide = createFirstGuide({ store: guideStore, mode: settings.get().controls, enabled: !tut && deps.firstGuide !== false && settings.get().tips });
      const canvas = h('canvas', { class: 'court' });
      const view = matchScreen({
        oppName: opp.name,
        oppTags: oppProfile(opp, { tutorial: !!tut }).tags,
        canvas,
        quitLabel: tut ? '나가기' : '포기',
        // 간단 조작: 샷 버튼을 누르는 순간 = 스윙 (샷 종류는 상대 공을 보고 매번 새로 정한다)
        onSwing: (k) => { if (view.guideOpen) return; audio.unlock(); tipper.acted(); if (ctl.swing(clock(), k)) view.flashShot(k); },
        onQuit: () => {
          if (tut) { loop = null; api.showTitle(); return; } // 튜토리얼은 언제든 페널티 없이 나감
          const ctl2 = api.controller;
          const elapsed = nowFn() - startedAt - clock.pausedFor(); // 안내로 멈춰 있던 시간은 빼고 센다
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
      mount(view.el); bgm.play('match');
      view.setShotBar(mode === 'simple'); view.setLane(mode === 'simple' ? 'center' : null); view.setRps(mode === 'simple' && !tut);
      const renderer = createRenderer(canvas, { options: () => settings.get() });
      renderer.setControlMode(mode);
      audio.unlock(); // 경기 시작 클릭(사용자 제스처) 안에서 오디오 허용
      renderer.setOpponentLook(opp.rival ? 'rival' : 'opp');
      const seed = deps.seed ?? ((Date.now() & 0xffffffff) >>> 0); // deps.seed: QA 정지 화면용 고정 시드
      const ctl = createMatchController({
        stats: tut ? TUTORIAL_STATS : effectiveStats(state),
        oppParams: tut ? TRAINER_PARAMS : applyGameLevel(aiParamsFor(state, opp), settings.get().gameLevel), // 경기 시작 시점의 게임 난이도 (경기 중 고정)
        rng: createRng(seed),
        difficulty: tut ? 'tutorial' : settings.get().difficulty, // 경기 시작 시점의 난이도 (경기 중 고정)
        controlMode: mode, useMatchup: !tut, // 튜토리얼은 상성 없이 기본기부터
        courtWidth: canvas.clientWidth || 300,
        onEvent: (e) => {
          renderer.notify(e, clock());
          react(e, { audio, haptics });
          if (e.type === 'grade' || e.type === 'point') clock.slow(1); // 첫 공 안내 뒤 슬로모션은 내가 치는 순간 끝
          if (e.type === 'lane') { view.setLane(e.lane); renderer.setLane(e.lane); }
          if (e.type === 'grade') {
            const mu = e.matchup === 'win' ? ' · 카운터!' : e.matchup === 'lose' ? ' · 역회전에 밀렸다…' : '';
            view.setJudge((e.grade === 'MISS' ? 'MISS' : e.grade === 'PERFECT' ? 'PERFECT!' : e.grade === 'BAD' ? 'BAD' : 'GOOD') + (e.grade === 'MISS' ? '' : mu), e.grade.toLowerCase());
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
            const br = state.bracket?.final; const isFinal = stage === 'tournament' && !!br && br.winner === null && (br.a === 0 || br.b === 0); // 리그를 가르는 결승인가
            const story = storyOn() && opp.rival ? rivalPostMatch(state, opp, won, { final: isFinal }) : null; // 라이벌전: 승패 대사 (진 횟수도 센다 — 아래 persist 로 저장)
            // 결과 반영은 경기당 정확히 1회 (end 이벤트는 1회만 발생)
            const rng = createRng((Date.now() ^ (state.week * 7919)) >>> 0);
            const { gained } = stage === 'tournament'
              ? applyTournamentResult(state, { won, score: e.score }, rng)
              : applyRegularResult(state, { won, score: e.score }, rng);
            persist(); ads.noteMatchPlayed();
            later(() => { if (loop === token) api.showResult({ won, score: e.score, gained, story }); }, 800);
          }
        },
      });
      const tipper = createTipper({ store: tipsStore, enabled: () => !tut && !guide.active && settings.get().tips, tips: tipsFor(mode) });
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
        if (view.guideOpen) return; // 안내 중엔 코트 터치 무시
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
      // 공 종류 칩은 화면 위쪽(안내 카드 아래)에 가려지므로 '지금 오는 공'과 이기는 버튼을 글로 직접 알려준다 (구질 위장 중엔 생략)
      const livePick = (page) => {
        if (page.id !== 'pick' || mode !== 'simple' || !ctl.flight || ctl.spinHidden(clock())) return '';
        const k = shotKeyOfSpin(ctl.flight.spin);
        return `\n▶ 지금 오는 공: ${SHOT_TYPES[k].label} → [${SHOT_TYPES[counterOf(k)].label}] 버튼이 유리!`;
      };
      function openGuide(trigger, pages) {
        clock.pause();
        let i = 0;
        const close = (slow) => { view.hideGuide(); clock.resume(); if (slow) clock.slow(0.5); }; // 첫 공은 안내 뒤 절반 속도로 시작해 따라 해볼 시간을 준다
        const show = () => view.showGuide({
          step: `${i + 1}/${pages.length}`, title: pages[i].title, text: pages[i].text + livePick(pages[i]), last: i === pages.length - 1,
          onNext: () => { if (++i < pages.length) show(); else { guide.finish(trigger); for (const id of GUIDE_COVERS[mode]?.[trigger] ?? []) tipsStore.add(id); close(trigger === 'incoming'); } },
          onSkip: () => { guide.skipAll(); for (const t of Object.values(GUIDE_COVERS[mode] ?? {})) for (const id of t) tipsStore.add(id); close(false); },
        });
        show();
      }
      ctl.start(clock());
      let wasServing = false; let shownServer = null; let shownHint = null;
      const tick = () => {
        if (loop !== token) return;
        const now = clock();
        ctl.update(now);
        if (tut) view.drawCoachDiagram(nowFn(), mode); // 튜토리얼 설명 그림(움직임)
        renderer.setHint(tut ? tut.view.hint : null); // 레인·화살표 안내(튜토리얼 단계별)
        renderer.draw(ctl, now);
        view.setScore(ctl.shownScore.me, ctl.shownScore.opp, ctl.match.server); // 득점 알림 전엔 이전 점수 유지 (공이 닿기 전에 점수가 먼저 바뀌지 않게)
        const serving = ctl.phase === 'awaitServe' || ctl.phase === 'oppServeWait';
        if (serving && !wasServing) { view.flashServe(ctl.match.server, mode); view.setPoint(null); } // 다음 서브가 시작되면 득점/실점 배너를 치운다
        if (serving && !wasServing) view.setJudge(''); // 서브 차례가 시작되는 순간 크게 알림
        wasServing = serving;
        if (ctl.match.server !== shownServer) { shownServer = ctl.match.server; view.setServe(shownServer); }
        const situation = ctl.phase === 'awaitServe' ? 'awaitServe' : (ctl.phase === 'flight' && ctl.timing && !ctl.pendingDown ? 'incoming' : null);
        // 간단 조작: 날아오는 공의 종류 칩 (이걸 보고 상성에 맞는 샷을 고른다). 튜토리얼에서는 숨김
        const inKey = mode === 'simple' && !tut && situation === 'incoming' && ctl.flight ? shotKeyOfSpin(ctl.flight.spin) : null;
        const hidden = inKey && ctl.spinHidden(now); // 구질 위장(상위 리그): 타구 직후엔 종류를 알려주지 않는다
        view.setIncoming(inKey && !hidden ? incomingLabel(inKey) : '', hidden ? null : inKey);
        // 힌트: 처음 HINT_MATCHES 경기까지 이기는 버튼을 반짝인다 (튜토리얼은 단계별 힌트가 따로 있다)
        if (!tut && mode === 'simple') {
          const want = inKey && !hidden && (ads.lifetimeMatches < HINT_MATCHES || guide.active) ? counterOf(inKey) : null;
          if (want !== shownHint) { shownHint = want; view.setShotHint(want); }
        }
        // 첫 경기 안내: 서브 차례 / 첫 공이 튕겨 띠가 나타난 직후에 경기를 멈추고 페이지를 넘기며 설명 (시계가 멈춰 랠리가 그대로 정지)
        if (guide.active && !view.guideOpen) {
          const trigger = ctl.phase === 'awaitServe' ? 'serve' : (situation === 'incoming' && ctl.flight?.tLand != null && now - ctl.t0 >= ctl.flight.tLand ? 'incoming' : null);
          const pages = trigger && guide.take(trigger);
          if (pages) openGuide(trigger, pages);
        }
        view.setTip(tipper.update(situation, now, ctl.t0)?.text ?? '');
        raf(tick);
      };
      raf(tick);
      api.controller = ctl; api.matchView = view;
    },
    // ---------- 멀티플레이 ----------
    /** 멀티플레이 로비: 방 만들기(6자리 코드) / 코드로 참가. 연결·시계 동기화가 끝나면 바로 경기 시작 */
    showMultiplayer(opts = {}) {
      loop = null; bgm.play('title');
      let session = null;
      const dropSession = (reason) => { const s = session; session = null; if (s) s.close(reason); };
      const view = multiScreen({
        onHost: () => begin('host'),
        onJoin: (code) => {
          if (!/^[A-Z2-9]{6}$/.test(code)) { view.setMode('menu', { message: '6자리 방 코드를 입력해 주세요.' }); return; }
          begin('guest', code);
        },
        onCancel: () => { dropSession('cancel'); view.setMode('menu'); },
        onBack: () => { dropSession('cancel'); api.showTitle(); },
      });
      const errText = (e) => {
        const m = String(e?.message ?? e);
        return m === 'room-not-found' ? '그 코드의 방이 없어요. 코드를 다시 확인해 주세요.'
          : m === 'firebase-not-configured' ? '멀티플레이 서버 설정이 없어요.'
          : m === 'connect-timeout' ? '연결 시간이 초과됐어요. 다시 시도해 주세요.' : '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
      };
      async function begin(role, code = '') {
        audio.unlock();
        if (session) return;
        const room = (deps.roomFactory ?? (() => new FirebaseRoom()))();
        const s = createNetSession({
          room, role, name: role === 'host' ? '방장' : '손님', nowFn, timers: deps.netTimers,
          onPhase: (p) => { if (session === s && p === 'syncing') view.setMode('syncing'); },
          onStart: (info, sess) => { if (session === s) session = null; api.startNetMatch({ session: sess, ...info }); }, // 첫 경기와 다시 하기 모두
          onRematch: () => api.netResultView?.setStatus(api.netRematchMine ? 'wait' : 'asked'),
          onGame: (msg) => api.netInbound(msg),
          onEnd: (reason) => {
            if (session === s) { session = null; view.setMode('menu', { message: reason === 'disconnected' || reason === 'peer-left' || reason === 'timeout' ? '연결이 끊겼어요.' : '' }); }
            else api.netEnded?.(reason, s); // 경기 중·결과 화면에서 끊김
          },
        });
        session = s;
        try {
          if (role === 'host') { view.setMode('hosting'); const c = await s.host(); view.setMode('hosting', { code: c }); }
          else { view.setMode('joining'); await s.join(code); view.setMode('syncing'); }
        } catch (e) {
          if (session === s) { session = null; try { s.close('error'); } catch { /* 무시 */ } view.setMode('menu', { message: errText(e) }); }
        }
      }
      if (opts.message) view.setMode('menu', { message: opts.message });
      mount(view.el);
    },
    /** 상대 메시지: 경기 컨트롤러가 준비되기 전에 오면 큐에 둔다 */
    netInbound(msg) { if (api.netController) api.netController.remoteMessage(msg); else (api.netBacklog ??= []).push(msg); },
    /** 멀티플레이 경기. 서로 같은 능력치·판정·공 속도, 상성 포함 간단 조작. 기록·포인트·광고 없음 */
    startNetMatch({ session, first, again = false }) {
      const mode = 'simple';
      const clock = createGameClock(nowFn, NET_BALL_SCALE); api.gameClock = clock;
      const netClock = createNetClock({ nowFn, clock, scale: NET_BALL_SCALE, offset: session.offset });
      const canvas = h('canvas', { class: 'court' });
      let lastMiss = null; let ended = false; let result = null;
      const exit = (notify = true) => { ended = true; loop = null; api.netController = null; api.netSession = null; if (notify) session.close('left'); api.showTitle(); };
      const view = matchScreen({
        oppName: session.peerName || '상대', oppTags: [], canvas, quitLabel: '나가기',
        onSwing: (k) => { audio.unlock(); if (ctl.swing(clock(), k)) view.flashShot(k); },
        onQuit: () => { if (!ended && ctl.phase !== 'over' && !confirmFn('나가면 이 경기는 패배로 끝나요. 나갈까요?')) return; exit(true); },
      });
      mount(view.el); bgm.play('match');
      view.setShotBar(true); view.setLane('center'); view.setRps(true);
      const renderer = createRenderer(canvas, { options: () => settings.get() });
      renderer.setControlMode(mode); renderer.setOpponentLook('opp');
      const iAmFirst = first === session.role;
      const ctl = createMatchController({
        stats: NET_STATS, rng: createRng((Date.now() & 0xffffffff) >>> 0), difficulty: NET_DIFFICULTY, controlMode: mode, useMatchup: true,
        firstServer: iAmFirst ? 'me' : 'opp', courtWidth: canvas.clientWidth || 300,
        remote: { clock: netClock, delay: () => session.delay, send: (msg) => session.send(msg) },
        onEvent: (e) => {
          renderer.notify(e, clock());
          react(e, { audio, haptics });
          if (e.type === 'lane') { view.setLane(e.lane); renderer.setLane(e.lane); }
          if (e.type === 'grade') {
            const mu = e.matchup === 'win' ? ' · 카운터!' : e.matchup === 'lose' ? ' · 역회전에 밀렸다…' : '';
            view.setJudge((e.grade === 'MISS' ? 'MISS' : e.grade === 'PERFECT' ? 'PERFECT!' : e.grade === 'BAD' ? 'BAD' : 'GOOD') + (e.grade === 'MISS' ? '' : mu), e.grade.toLowerCase());
          }
          if (e.type === 'missed') lastMiss = e;
          if (e.type === 'point') {
            view.setScore(e.score.me, e.score.opp, null); view.flashScore(e.winner); view.setJudge('');
            view.setPoint(describePoint(e, lastMiss)); lastMiss = null;
          }
          if (e.type === 'end') { result = { won: e.winner === 'me', score: e.score }; later(() => { if (!ended && loop === token) api.showNetResult({ session, ...result }); }, 900); }
        },
      });
      api.netController = ctl; api.netSession = session; api.controller = ctl; api.matchView = view;
      for (const m of api.netBacklog ?? []) ctl.remoteMessage(m);
      api.netBacklog = [];
      const token = {}; loop = token;
      const toLocal = (ev) => { const r = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0 }; return [ev.clientX - r.left, ev.clientY - r.top]; };
      canvas.addEventListener('pointerdown', (ev) => { ev.preventDefault?.(); audio.unlock(); const [x, y] = toLocal(ev); ctl.pointerDown(clock(), x, y); });
      canvas.addEventListener('contextmenu', (ev) => ev.preventDefault?.());
      ctl.start(clock());
      let wasServing = false; let shownServer = null;
      const tick = () => {
        if (loop !== token) return;
        const now = clock();
        ctl.update(now);
        renderer.setHint(null);
        renderer.draw(ctl, now);
        view.setScore(ctl.shownScore.me, ctl.shownScore.opp, ctl.match.server); // 득점 알림 전엔 이전 점수 유지 (공이 닿기 전에 점수가 먼저 바뀌지 않게)
        const serving = ctl.phase === 'awaitServe' || ctl.phase === 'oppServeWait';
        if (serving && !wasServing) { view.flashServe(ctl.match.server, mode); view.setPoint(null); view.setJudge(''); }
        wasServing = serving;
        if (ctl.match.server !== shownServer) { shownServer = ctl.match.server; view.setServe(shownServer); }
        const situation = ctl.phase === 'flight' && ctl.timing && !ctl.pendingDown ? 'incoming' : null;
        const inKey = situation && ctl.flight ? shotKeyOfSpin(ctl.flight.spin) : null;
        view.setIncoming(inKey ? incomingLabel(inKey) : '', inKey);
        const want = inKey && (ads.lifetimeMatches ?? 99) < HINT_MATCHES ? counterOf(inKey) : null; // 처음 몇 경기만 유리한 버튼 힌트
        view.setShotHint(want);
        raf(tick);
      };
      api.netRematchMine = false;
      api.netEnded = (reason) => { // 연결이 끊김: 결과 화면이면 표시만, 경기 중이면 로비로
        if (ended) return;
        if (result) { api.netResultView?.setStatus('gone'); return; }
        ended = true; loop = null; api.netController = null; api.netSession = null;
        api.showMultiplayer({ message: reason === 'left' ? '' : '연결이 끊겨 경기가 끝났어요.' });
      };
      tick();
    },
    /** 멀티플레이 결과 화면: 한 번 더(둘 다 누르면 새 경기) / 나가기 */
    showNetResult({ session, won, score }) {
      loop = null; api.netController = null;
      const view = netResultScreen({
        won, score, peerName: session.peerName,
        onAgain: () => { api.netRematchMine = true; session.rematch(); view.setStatus('wait'); },
        onExit: () => { api.netResultView = null; api.netEnded = null; session.close('left'); api.showTitle(); },
      });
      api.netResultView = view;
      react({ type: 'end', winner: won ? 'me' : 'opp' }, { audio, haptics });
      mount(view.el);
    },
  };
  return api;
}
