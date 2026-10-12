import { h } from './dom.js?v=1791816443';
import {
  titleScreen, rulesScreen, leagueHomeScreen, statsScreen, bracketScreen, resultScreen, matchScreen,
  equipScreen, seasonIntroScreen, seasonResultScreen, endingScreen, settingsScreen, introScreen, tutorialDoneScreen, rivalCardScreen, storyBeatScreen, storyIntroScreen,
  multiScreen, netResultScreen, trainingScreen,
} from './screens.js?v=1791816443';
import { eventScreen, eventResultScreen, cupScreen, draftScreen, draftPickedScreen } from './careerScreens.js?v=1791816443';
import { rerollCost, rerollDraft, pendingDraft, pickDraft, buyBonus, addGrowth, setGrowthDir, modsFor, rivalRecordText, ensureRogue } from '../game/roguelike.js?v=1791816443';
import { pendingEvent, resolveEvent } from '../game/events.js?v=1791816443';
import { revengeOffer, applyRevengeResult } from '../game/season.js?v=1791816443';
import { cupOffer, activeCup, startCup, skipCup, closeCup, cupMatch, cupParams, cupView, applyCupResult } from '../game/cup.js?v=1791816443';
import { addMatchToTally } from '../game/review.js?v=1791816443';
import { createLearnStore } from '../game/learn.js?v=1791816443';
import { selectSkin, selectTitle, wonLeagues } from '../game/perks.js?v=1791816443';
import { createNetSession } from '../net/session.js?v=1791816443';
import { createNetClock } from '../net/clock.js?v=1791816443';
import { FirebaseRoom, anonymousUid } from '../net/fireroom.js?v=1791816443';
import { resolveIdentity, checkPassword, quickBefore } from '../net/nicks.js?v=1791816443';
import {
  drawIntro, captionAt, createIntroController, INTRO_W, INTRO_H,
} from './intro.js?v=1791816443';
import { drawStoryIntro, captionAt as storyCaptionAt, createStoryIntro, INTRO_W as SI_W, INTRO_H as SI_H } from './storyIntro.js?v=1791816443';
import { createSettings, SETTING_DEFS } from '../game/settings.js?v=1791816443';
import { createTipsStore, createTipper, tipsFor } from '../game/tips.js?v=1791816443';
import { startTour } from './spotlight.js?v=1791816443';
import { createGuideStore, createMenuGuideStore, createFirstGuide, GUIDE_COVERS } from '../game/firstGuide.js?v=1791816443';
import { introBeat, pendingBeat, clearBeat, markBeat, rivalPreMatch, rivalPostMatch, beatOf } from '../game/story.js?v=1791816443';
import { SHOT_TYPES, shotKeyOfSpin, counterOf, HINT_MATCHES } from '../game/controls.js?v=1791816443';
import { applyGameLevel, gameLevelOf, effectiveGameLevel } from '../game/gamelevel.js?v=1791816443';
import { describePoint, incomingLabel } from '../game/pointReason.js?v=1791816443';
import { oppProfile } from '../game/oppProfile.js?v=1791816443';
import { createGameClock, ballSpeedOf } from '../game/ballspeed.js?v=1791816443';
import { DIAGRAM_FOR_STEP } from './rules.js?v=1791816443';
import { createAdManager, providerFromWindow } from '../game/ads.js?v=1791816443';
import { createTutorial, createTutorialStore, TRAINER_PARAMS, TRAINER_PICK_PARAMS, TUTORIAL_STATS } from '../game/tutorial.js?v=1791816443';
import { createAudio } from './audio.js?v=1791816443';
import { createBgm } from './bgm.js?v=1791816443';
import { createHaptics, react } from './feedback.js?v=1791816443';
import { installPressFeedback } from './pressfx.js?v=1791816443';
import { planLiveRound, createLiveTicker } from '../game/liveRound.js?v=1791816443';
import { snapshotBefore, buildRecap } from '../game/recap.js?v=1791816443';
import { createMatchTally, createRecordsStore } from '../game/records.js?v=1791816443';
import { createTrainingStore, trainingParams, trainingReward, TRAIN_OPPONENT } from '../game/training.js?v=1791816443';
import { createRenderer } from './render.js?v=1791816443';
import { createMatchController } from '../game/matchController.js?v=1791816443';
import {
  newGame, nextMatch, aiParamsFor, effectiveStats, equip, bracketView, ranking, migrate, startNextSeason,
  applyRegularResult, applyTournamentResult, seasonGoals, startCycle,
} from '../game/season.js?v=1791816443';
import { createStore } from '../game/store.js?v=1791816443';
import { createRng, MIN_REACTION_S } from '../core/index.js?v=1791816443';
import { applyIosTopGap } from './iosTopGap.js?v=1791816443';


/** 앱 부트스트랩. root: 마운트 요소, deps: 테스트 주입용 { store, raf, nowFn } */
export const FORFEIT_AFTER = 120;
/** 멀티플레이: 두 사람이 같은 조건 — 능력치·판정 범위·공 속도를 고정한다 (기록·포인트·시즌과 무관) */
const NICK_KEY = 'tabgu-king-nick-v1';
const CLAIMED_KEY = 'tabgu-king-nick-claimed-v1'; // (옛 버전) 서버에 선점해 둔 닉네임 — 있으면 그대로 잠근 닉네임으로 이어받는다
const LOCK_KEY = 'tabgu-king-nick-locked-v1'; // 멀티 닉네임: 첫 진입에서 한 번 정하면 {nick, uid} 로 잠긴다 (변경 불가)
const QUICK_POLL_MS = 2500; const QUICK_MAX_STEPS = 24; // 빠른 대전: 약 60초 동안 찾는다
export const NET_STATS = Object.freeze({ power: 7, spin: 7, focus: 7 });
export const NET_DIFFICULTY = 'normal';
export const NET_BALL_SCALE = 0.8; // 경기 시작 후 이 시간(초) 이상 지나 포기하면 기권패

/** 최소 반응창의 실시간 하한 0.25초 (게임성 리뷰 #15): 게임 시계 배율이 클수록(원래 속도 1.0) 게임 초 → 실시간 초가 짧아지므로 하한을 배율에 비례해 올린다. 보통(0.8)은 0.2 게임초 = 0.25초라 그대로 */
export const REALTIME_REACTION_S = 0.25;
export const withRealtimeFloor = (params, scale) => (scale > 0.8 ? { ...params, minReactionS: Math.max(MIN_REACTION_S, REALTIME_REACTION_S * scale) } : params);

/** 장비 화면이 의미 있는가: 그립·라켓이 둘 이상이거나 우승 특전(칭호·스킨)이 있을 때 */
export const needsEquipScreen = (st) => st.unlocked.grips.length > 1 || st.unlocked.rackets.length > 1 || wonLeagues(st).length > 0;

/** 홈 가이드 투어 순서 (data-tour 요소가 없는 단계는 자동으로 건너뜀) */
const HOME_TOUR = Object.freeze([
  { id: 'table', text: '리그 순위표예요. 9경기 뒤 상위 4위가 토너먼트에 가요.' },
  { id: 'next', text: '다음 상대예요.' },
  { id: 'stats', text: '내 능력치와 포인트예요.' },
  { id: 'play', text: '여기서 경기를 시작해요. 조작은 경기 중에 알려줘요.' },
  { id: 'invest', text: '포인트로 능력치를 올려요.' },
  { id: 'equip', text: '라켓과 그립을 골라요. 우승하면 칭호·스킨도 생겨요.' },
  { id: 'train', text: '기록 없는 연습 경기예요.' },
  { id: 'bracket', text: '연말 토너먼트 대진표예요.' },
]);

export function createApp(root, deps = {}) {
  // iOS 상태바 아래 시스템 흐림 띠를 피해 경기 화면 상단 띠에 불투명 빈칸(--gap 24px)을 둔다 (iosTopGap.js / style.css :root.ios-top-gap)
  applyIosTopGap(deps.doc ?? globalThis.document, deps.nav ?? globalThis.navigator);
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
  installPressFeedback(root, { audio, haptics, nav: deps.nav ?? globalThis.navigator }); // 모든 메뉴 버튼: 누르면 작아지고 어두워짐 + 짧은 진동(iOS 제외) + 클릭음
  // 광고 훅: 기본은 '광고 없음'(provider 없음) → 동작 변화 없음. 나중에 provider 만 꽂으면 아래 자연스러운 끊김(AD_SLOTS)에서 동작
  const ads = deps.ads ?? createAdManager({
    provider: providerFromWindow(globalThis), nowFn, storage: store.storage,
    onEvent: (e) => { if (e.type === 'start') { audio.setSuspended?.(true); bgm.setSuspended(true); } if (e.type === 'end') { audio.setSuspended?.(false); bgm.setSuspended(false); } }, // 광고 중 효과음·배경음악 정지
  });
  const tutorialStore = deps.tutorialStore ?? createTutorialStore(store.storage ?? globalThis.localStorage);
  const tipsStore = deps.tipsStore ?? createTipsStore(store.storage ?? globalThis.localStorage);
  const storyOn = () => deps.story !== false; // 스토리 컷(라이벌 대사·시즌 비트). 테스트는 끌 수 있다
  const recordsStore = deps.recordsStore ?? createRecordsStore(store.storage ?? globalThis.localStorage); // 개인 기록: 시즌 저장과 별도 키 (새로 시작해도 유지, 저장 데이터 삭제로 지워짐)
  const trainingStore = deps.trainingStore ?? createTrainingStore(store.storage ?? globalThis.localStorage); // 훈련 하루 한도 (저장 삭제·새로 시작으로 리셋되지 않는다)
  const menuGuideStore = deps.menuGuideStore ?? createMenuGuideStore(store.storage ?? globalThis.localStorage);
  const onboarding = deps.onboarding === true; // 새 플레이어 안내(튜토리얼 권유·메뉴 설명): main.js 가 켠다. 테스트는 기본 꺼짐
  const guideStore = deps.guideStore ?? createGuideStore(store.storage ?? globalThis.localStorage);
  const learn = deps.learnStore ?? createLearnStore(store.storage ?? globalThis.localStorage); // 상성 학습 진행도: 카운터 누적 15회 전까지 글자 힌트
  const reducedMotion = deps.reducedMotion ?? (() => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  let state = migrate(store.load());
  let loop = null; // 경기 루프 중단 플래그
  let backFn = null; // 지금 화면의 '뒤로' 동작 (Android 백키용). null 이면 앱 기본(종료 확인)
  let platformHeld = false; // 플랫폼(원스토어)이 게임을 멈추라고 한 상태
  let resultToken = null;

  // 화면 전환 때 스크롤을 맨 위로: 이전 화면(긴 홈 등)에서 내려온 스크롤이 남으면 새 화면의 윗부분(점수판·제목)이 잘려 보인다
  const toTop = () => { try { globalThis.scrollTo?.(0, 0); const d = globalThis.document; if (d?.documentElement) d.documentElement.scrollTop = 0; if (d?.body) d.body.scrollTop = 0; } catch { /* 무시 */ } };
  const mount = (el, back = null) => { while (root.firstChild) root.removeChild(root.firstChild); root.appendChild(el); backFn = back ? () => { back(); return true; } : null; toTop(); };
  const persist = () => store.save(state);
  // 새 게임·데이터 삭제: '첫 경기' 안내(평생 한 번 저장)와 일반 힌트의 본 기록도 처음으로 — 한 번 본 기기에서 새로 시작해도 첫 경기에 안내가 다시 나온다
  const resetGuides = () => { menuGuideStore.clear(); guideStore.clear(); tipsStore.clear(); learn.clear(); };

  const api = {
    get state() { return state; },
    get tutorialStore() { return tutorialStore; },
    // ---- 플랫폼(원스토어 H5 SDK) 연동 지점: main.js 가 SDK 이벤트를 여기에 잇는다 ----
    /** pause: 게임 루프·BGM·효과음 즉시 정지 */
    platformPause() { platformHeld = true; bgm.setSuspended(true); audio.setSuspended?.(true); api._hold?.pause(); },
    /** resume: 재개 (탭이 숨겨진 상태면 BGM 은 계속 멈춤) */
    platformResume() { platformHeld = false; audio.setSuspended?.(false); bgm.setSuspended(!!globalThis.document?.hidden); api._hold?.resume(); },
    /** exit: 진행 상황 저장 (동기, 0.5초 안) */
    saveNow() { try { if (state) persist(); } catch { /* 저장 실패는 종료를 막지 않는다 */ } },
    /** Android 백키 (동기, 200ms 내 회신): 게임이 처리했으면 true, 아니면 false → 앱의 종료 확인창 */
    handleBack() {
      const skip = root.querySelector?.('.tour .tour-skip'); // 가이드 투어가 떠 있으면 먼저 닫는다
      if (skip) { skip.click(); return true; }
      return backFn ? backFn() === true : false;
    },
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
      mount(view.el, () => { loop = null; api.showTitle(); });
      const token = {}; loop = token; const t0 = nowFn();
      const tick = () => { if (loop !== token) return; view.draw(nowFn() - t0); raf(tick); };
      tick();
    },
    showSettings() {
      mount(settingsScreen({
        defs: SETTING_DEFS,
        values: settings.get(),
        onToggle: (k) => { settings.cycle(k); audio.unlock(); bgm.sync(); api.showSettings(); },
        onReset: () => {
          if (!confirmFn('저장된 시즌 데이터가 모두 삭제됩니다. 설정은 유지됩니다. 삭제할까요?')) return;
          store.clear(); recordsStore.clear(); resetGuides(); state = null; api.showTitle();
        },
        onBack: () => api.showTitle(),
      }), () => api.showTitle());
    },
    /** 홈 가이드 투어: 리그표·다음 상대·스탯·경기 시작·메뉴 버튼을 하이라이트 박스로 하나씩 짧게 소개. 첫 홈에서 한 번 자동, 홈의 ❓ 버튼으로 다시 */
    startHomeTour() {
      menuGuideStore.mark();
      startTour(root, HOME_TOUR);
    },
    /** 새 시즌 시작 연출(목표 안내). 새로 시작·다음 시즌에서만 보이고, 이어하기는 바로 홈 */
    showSeasonIntro() {
      loop = null;
      const story = storyOn() ? introBeat(state) : null; // 이 리그에서 처음일 때만 도입 컷
      mount(seasonIntroScreen({ intro: seasonGoals(state), onStart: () => api.showHome(), story }).el);
      if (story) { markBeat(state, story.id); persist(); }
    },
    showHome() {
      loop = null; bgm.play('title');
      const beat = storyOn() && state ? pendingBeat(state) : null; // 주차가 되면 스토리 컷(연패·중반·관계·결승)을 한 장씩 보여 주고 홈으로
      if (beat) { mount(storyBeatScreen({ beat, onNext: () => { markBeat(state, beat.id); persist(); api.showHome(); } })); return; }
      if (pendingDraft(state)?.source === 'retry') { api.showDraft(() => api.showHome()); return; } // 재도전 시즌: 1주차 경기 전 드래프트 선지급 (고를 때까지 홈 앞에서 연다)
      const pe = pendingEvent(state); // 커리어 이벤트(정규 시즌 4·7주차): 홈에 강조 버튼으로 알린다 (경기 진행은 막지 않음 — 그 주차를 넘기면 사라진다)
      const offer = cupOffer(state); const live = activeCup(state);
      mount(leagueHomeScreen({
        state,
        onDraft: pendingDraft(state) ? () => api.showDraft(() => api.showHome()) : null,
        onEvent: pe ? () => api.showEvent(pe) : null, eventLabel: pe ? `📣 이벤트: ${pe.event.title}` : '',
        onCup: live || offer ? () => api.showCup() : null,
        cupLabel: live ? `${live.name} 진행 중 (${cupView(state).roundName})` : offer ? `${offer.name} 참가 신청` : '월간 컵',
        onPlay: () => (needsEquipScreen(state) ? api.showEquip() : api.beforeMatch()), // 고를 장비·특전이 없으면 장비 화면을 건너뛴다 (게임성 리뷰 #13)
        onEquip: () => api.showEquip(),
        onHelp: () => api.startHomeTour(),
        onStats: () => api.showStats(),
        onBracket: () => api.showBracket(),
        onTrain: () => api.showTraining(),
        onRevenge: revengeOffer(state) ? () => api.startMatch({ revenge: true }) : null,
        onTitle: () => ads.runBreak('titleReturn', () => api.showTitle()), // 광고 훅: 홈 → 타이틀
        onSeasonEnd: () => api.showSeasonResult(),
      }));
      if (onboarding && !menuGuideStore.seen && state.season === 1 && state.week === 1 && state.phase === 'regular') api.startHomeTour(); // 첫 홈: 가이드 투어를 한 번
    },
    /** 커리어 이벤트: 확률형/확정형 선택 → 결과 */
    showEvent(pe) {
      loop = null;
      mount(eventScreen({
        event: pe.event, points: state.statPoints,
        onChoose: (choice) => {
          const rng = createRng(((Date.now() & 0xffffffff) ^ Math.imul(state.week + 1, 2654435761)) >>> 0); // 경기·시즌 난수와 분리된 이벤트 전용 흐름
          const result = resolveEvent(state, choice, rng); persist();
          mount(eventResultScreen({ event: pe.event, result, onNext: () => (result.draft ? api.showDraft(() => api.showHome()) : api.showHome()) }));
        },
      }));
    },
    /** 시즌 특성 드래프트: 3택1 → 확인 → next (리그 2·4·6승째 / 이벤트 보상). 안 고르고 나가도 홈에 '고르기' 버튼이 남는다 */
    showDraft(next) {
      loop = null;
      const draft = pendingDraft(state);
      if (!draft) { next(); return; }
      mount(draftScreen({
        draft, build: ensureRogue(state).build, points: state.statPoints, rerollCost: rerollCost(state),
        onReroll: () => { if (rerollDraft(state)) { persist(); api.showDraft(next); } },
        onPick: (id) => {
          const r = pickDraft(state, id); persist();
          mount(draftPickedScreen({ picked: r.picked, dropped: r.dropped, onNext: next }));
        },
      }));
    },
    /** 월간 컵: 참가 신청 / 대진표 / 결과 */
    showCup() {
      loop = null;
      mount(cupScreen({
        view: cupView(state), offer: cupOffer(state), next: cupMatch(state),
        onJoin: () => { const o = cupOffer(state); if (o) { startCup(state, o.slot); persist(); } api.showCup(); },
        onSkip: () => { const o = cupOffer(state); if (o) { skipCup(state, o.slot); persist(); } api.showHome(); },
        onStart: () => api.startMatch({ cup: true }),
        onClose: () => { closeCup(state); persist(); api.showHome(); },
        onBack: () => api.showHome(),
      }));
    },
    showStats() {
      mount(statsScreen({
        state,
        onInvest: (k) => { if (state.statPoints > 0) { state.stats[k] += 1; state.statPoints -= 1; addGrowth(state, k, 1); persist(); } api.showStats(); }, // 성장 줄기: 투자한 방향이 한 칸 자란다
        onBuy: (id) => { buyBonus(state, id); persist(); api.showStats(); },
        onBack: () => api.showHome(),
      }), () => api.showHome());
    },
    /** 훈련 모드: 시즌 밖 연습 경기 (하루 도전 한도) */
    showTraining() {
      loop = null; bgm.play('title');
      mount(trainingScreen({
        state, status: trainingStore.status(),
        onStart: () => api.startMatch({ training: true }),
        onDir: (k) => { setGrowthDir(state, k); persist(); api.showTraining(); },
        onBack: () => api.showHome(),
      }), () => api.showHome());
    },
    showBracket() {
      const br = bracketView(state);
      const top = !br && state.phase === 'regular' ? ranking(state).slice(0, 4) : null; // 토너먼트 전: 현재 순위 기준 예상 대진
      const pv = top?.length === 4 ? { left: Math.max(0, 9 - (state.week - 1)), semis: [[0, 3], [1, 2]].map(([a, b]) => ({ a: top[a].name, b: top[b].name, me: top[a].id === 0 || top[b].id === 0, winner: null, score: null })) } : null;
      mount(bracketScreen({ bracket: br, preview: pv, onBack: () => api.showHome() }), () => api.showHome());
    },
    showEquip() {
      mount(equipScreen({
        state,
        onChange: (kind, id) => {
          equip(state, kind === 'grip' ? id : state.grip, kind === 'racket' ? id : state.racket);
          persist(); api.showEquip();
        },
        onTitle: (id) => { selectTitle(state, id); persist(); api.showEquip(); },
        onSkin: (id) => { selectSkin(state, id); persist(); api.showEquip(); },
        onStart: () => api.beforeMatch(),
        onBack: () => api.showHome(),
      }), () => api.showHome());
    },
    /** 경기 시작 직전: 라이벌전이면 라이벌 소개·대사 컷(처음엔 '첫 등장' 대사까지)을 보여 주고 경기 화면으로 */
    beforeMatch() {
      const nm = storyOn() && state ? nextMatch(state) : null;
      const pre = nm ? rivalPreMatch(state, nm.opp) : null;
      if (!pre) { api.startMatch(); return; }
      persist();
      mount(rivalCardScreen({ rival: pre.rival, lines: pre.lines, first: pre.first, record: rivalRecordText(state), onStart: () => api.startMatch() }));
    },
    showResult(result) {
      loop = null; bgm.play('title');
      const token = {}; resultToken = token;
      ads.prepare('doublePoints'); // 광고 훅: 보상형(결과 화면에서 포인트 2배) 미리 준비
      let animated = false; // 순위 변동 연출은 처음 한 번만 (보상 광고 준비로 다시 그릴 때 반복 방지)
      const render = (res) => {
        const offer = !res.rewarded && !res.forfeit && !res.training && ads.canOfferReward('doublePoints'); // 훈련 경기는 보상형 광고 없음
        mount(resultScreen({
          result: res, animate: !animated,
          // 광고 훅: 경기 종료 후 — '계속'을 누르는 자연스러운 끊김 (광고가 없으면 즉시 진행)
          onNext: () => {
            const go = () => (res.training ? api.showTraining() : res.cup ? api.showCup() : res.revenge ? api.showHome() : ads.runBreak('afterMatch', () => (state.phase === 'seasonEnd' ? api.showSeasonResult() : api.showHome())));
            if (!res.training && !res.cup && !res.revenge && pendingDraft(state)) api.showDraft(go); else go(); // 2·4·6번째 경기(승패 무관): 결과 화면 뒤 특성 드래프트
          },
          reward: offer ? {
            label: `광고 보고 포인트 2배 (+${res.gained})`,
            onClick: async () => {
              const r = await ads.offerRewarded('doublePoints'); // 사용자가 직접 누른 클릭 안에서
              if (r.rewarded) { state.statPoints += res.gained; persist(); render({ ...res, rewarded: true }); }
            },
          } : null,
        }));
        animated = true;
        // 보상 광고는 준비가 늦게 끝날 수 있어 잠시 뒤 한 번 더 확인
        if (!offer && !res.rewarded && !res.forfeit && !res.training) later(() => { if (resultToken === token && ads.canOfferReward('doublePoints')) render(res); }, 1200);
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
    showSeasonResult(keepStory) {
      loop = null;
      const summary = state.summary;
      const story = keepStory !== undefined ? keepStory : storyOn() && summary.champion && !summary.ending ? clearBeat(state, summary.league) : null; // 우승 직후 스토리 컷 (세계대회 우승은 엔딩 화면이 맡는다). 보너스 구매로 다시 그릴 땐 같은 컷을 유지
      if (story && keepStory === undefined) { markBeat(state, 'clear', summary.league); persist(); }
      mount(seasonResultScreen({
        summary, story, state,
        onBuy: (id) => { buyBonus(state, id); persist(); api.showSeasonResult(story); }, // 계승 보너스 투자 (결산 화면 통합)
        trainLeft: trainingStore.status().left, onTrain: () => api.showTraining(),
        onCycle: () => ads.runBreak('seasonEnd', () => { startCycle(state); persist(); api.showSeasonIntro(); }), // 세계대회 우승 후 2회차 (선택)
        // 광고 훅: 시즌 종료 후 — 다음 시즌으로 넘어가는 끊김
        onNext: () => ads.runBreak('seasonEnd', () => {
          if (summary.ending && state.endingPending) {
            state.endingPending = false; persist();
            if (storyOn()) markBeat(state, 'clear', summary.league);
            mount(endingScreen({ story: storyOn() ? beatOf('world', 'clear') : null, onNext: () => { startNextSeason(state); persist(); api.showSeasonIntro(); }, onCycle: () => { startCycle(state); persist(); api.showSeasonIntro(); } }));
          } else { startNextSeason(state); persist(); api.showSeasonIntro(); }
        }),
      }));
    },
    /** opts.tutorial: 코치와 하는 체험형 튜토리얼 (기록·포인트·광고·포기 페널티 없음) */
    startMatch(opts = {}) {
      const train = !!opts.training && !opts.tutorial && !!state; // 훈련 모드: 시즌 밖 연습 경기
      if (train && !trainingStore.consume()) { api.showTraining(); return; } // 도전 횟수는 시작할 때 차감 (나가기로 환불 없음)
      const tut = opts.tutorial ? (opts.tutInstance ?? createTutorial({ mode: settings.get().controls })) : null;
      const cupM = opts.cup && !opts.tutorial && !train && !!state ? cupMatch(state) : null; // 월간 컵 경기: 정규 시즌 상태는 건드리지 않는다
      const revM = opts.revenge && !opts.tutorial && !train && !cupM && !!state ? revengeOffer(state) : null; // 라이벌 설욕전(재도전 시즌 한정): 정규 일정과 별개의 한 판
      const nm = tut ? { opp: { name: '코치', style: 'balanced', rival: false }, stage: 'tutorial' } : train ? { opp: TRAIN_OPPONENT, stage: 'training' } : cupM ? { opp: cupM.opp, stage: 'cup' } : revM ? { opp: revM.opp, stage: 'revenge' } : nextMatch(state);
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
      // 리그전 속보: 정규 리그 본 경기에서만. 다른 경기 결과는 시작 때 정해 두고(preset) 경기 시계에 맞춰 보여준 뒤 순위표에 그대로 반영한다
      const live = !tut && !train && stage === 'regular' && deps.liveTicker !== false ? planLiveRound(state, createRng(deps.seed != null ? (deps.seed ^ 0x5bd1e995) >>> 0 : (Date.now() ^ 0x9e3779b1) >>> 0)) : null;
      const liveTicker = live?.games.length ? createLiveTicker(live.games) : null;
      // 내 경기 결과 반영 + (정규 리그면) 경기 후 상황 정리판 데이터: 다른 경기 결과·순위 변동
      const applyMine = (won, score, rng) => {
        if (stage === 'cup') return applyCupResult(state, { won, score });
        if (stage === 'revenge') return applyRevengeResult(state, { won });
        if (stage === 'tournament') return applyTournamentResult(state, { won, score }, rng);
        const snap = snapshotBefore(state); const round = state.week;
        const r = applyRegularResult(state, { won, score }, rng, live?.preset);
        return { ...r, recap: buildRecap(state, snap, round) };
      };
      const tally = tut ? null : createMatchTally(); // 경기 요약 집계 (튜토리얼 제외). 기권은 기록 반영 안 함
      const view = matchScreen({
        ticker: !!liveTicker,
        oppName: opp.name,
        oppTags: oppProfile(opp, { tutorial: !!tut }).tags,
        canvas,
        quitLabel: tut || train ? '나가기' : '포기',
        // 간단 조작: 샷 버튼을 누르는 순간 = 스윙 (샷 종류는 상대 공을 보고 매번 새로 정한다)
        onSwing: (k) => { if (view.guideOpen) return; audio.unlock(); tipper.acted(); if (ctl.swing(clock(), k)) view.flashShot(k); },
        onQuit: () => {
          if (tut) { loop = null; api.showTitle(); return; } // 튜토리얼은 언제든 페널티 없이 나감
          if (train) { loop = null; api.showTraining(); return; } // 훈련도 페널티 없음 (차감된 도전 횟수는 돌려주지 않는다)
          const ctl2 = api.controller;
          const elapsed = nowFn() - startedAt - clock.pausedFor(); // 안내로 멈춰 있던 시간은 빼고 센다
          if (!ctl2 || ctl2.phase === 'over') { loop = null; api.showHome(); return; }
          if (elapsed < FORFEIT_AFTER) { // 2분 이내: 기록 없이 취소 (실수로 눌러도 바로 나가지 않게 확인)
            if (!confirmFn('지금 나가면 이 경기는 기록 없이 취소돼요. 나갈까요?')) return;
            loop = null; api.showHome(); return;
          }
          if (!confirmFn('지금 포기하면 기권패로 기록됩니다. 포기할까요?')) return;
          loop = null;
          const sc = ctl2.match.score;
          const score = { me: sc.me, opp: Math.max(sc.opp, 11) }; // 기권패: 상대 11점 처리
          const rng = createRng((Date.now() ^ (state.week * 104729)) >>> 0);
          const { gained, recap } = applyMine(false, score, rng);
          persist(); ads.noteMatchPlayed();
          react({ type: 'end', winner: 'opp' }, { audio, haptics });
          api.showResult({ won: false, score, gained, forfeit: true, recap, cup: stage === 'cup', revenge: stage === 'revenge' });
        },
      });
      mount(view.el); bgm.play('match');
      backFn = () => { if (!view.guideOpen) later(() => view.quit(), 0); return true; }; // 백키 = 포기/나가기 버튼 (확인창은 회신 뒤에 띄운다: 확인창이 떠 있으면 200ms 회신을 못 한다)
      api._hold = { pause: () => clock.pause(), resume: () => { if (!view.guideOpen) clock.resume(); } }; // 플랫폼 pause/resume: 안내가 열려 있으면 resume 해도 계속 멈춘다
      if (platformHeld) clock.pause();
      view.setShotBar(mode === 'simple'); view.setLane(mode === 'simple' ? 'center' : null); view.setRps(mode === 'simple' && !tut);
      const renderer = createRenderer(canvas, { options: () => settings.get() });
      renderer.setControlMode(mode);
      audio.unlock(); // 경기 시작 클릭(사용자 제스처) 안에서 오디오 허용
      renderer.setOpponentLook(opp.rival ? 'rival' : 'opp');
      renderer.setSkin(tut ? 'default' : state?.skin ?? 'default'); // 우승 특전 스킨 (튜토리얼·멀티는 기본)
      const seed = deps.seed ?? ((Date.now() & 0xffffffff) >>> 0); // deps.seed: QA 정지 화면용 고정 시드
      const ctl = createMatchController({
        stats: tut ? TUTORIAL_STATS : effectiveStats(state),
        mods: tut ? null : modsFor(state), // 로그라이크: 계승 보너스·시즌 특성
        oppParams: tut ? TRAINER_PARAMS : withRealtimeFloor(applyGameLevel(train ? trainingParams(state.league, state.cycle ?? 1) : stage === 'cup' ? cupParams(state, opp) : aiParamsFor(state, opp), effectiveGameLevel(settings.get().gameLevel, state?.cycle ?? 1)), clock.scale), // 경기 시작 시점의 게임 난이도 (경기 중 고정)
        rng: createRng(seed),
        difficulty: tut ? 'tutorial' : settings.get().difficulty, // 경기 시작 시점의 난이도 (경기 중 고정)
        controlMode: mode, useMatchup: !tut, // 튜토리얼은 상성 없이 기본기부터
        courtWidth: canvas.clientWidth || 300,
        onEvent: (e) => {
          tally?.handle(e);
          if (e.type === 'grade' && e.matchup === 'win' && e.grade !== 'MISS') learn.add(1); // 상성 학습: 이기는 샷을 실제로 해 본 횟수
          renderer.notify(e, clock());
          react(e, { audio, haptics });
          if (e.type === 'grade' || e.type === 'point') clock.slow(1); // 첫 공 안내 뒤 슬로모션은 내가 치는 순간 끝
          if (e.type === 'lane') { view.setLane(e.lane); renderer.setLane(e.lane); }
          if (e.type === 'courseHint') renderer.setHintLane?.(e.lane); // 코스 읽기 특성
          if (e.type === 'grade') {
            const mu = e.matchup === 'win' ? ' · 카운터!' : e.matchup === 'lose' ? ' · 역회전에 밀렸다…' : '';
            view.setJudge((e.grade === 'MISS' ? 'MISS' : e.grade === 'PERFECT' ? 'PERFECT!' : e.grade === 'BAD' ? 'BAD' : 'GOOD') + (e.grade === 'MISS' ? '' : mu), e.grade.toLowerCase());
          }
          if (e.type === 'missed') lastMiss = e; // 직전 타이밍 실수(일찍/늦게/무탭): 실점 원인 표시에 쓴다
          if (e.type === 'point') {
            renderer.setHintLane?.(null);
            view.setScore(e.score.me, e.score.opp, null);
            view.flashScore(e.winner);
            view.setJudge('');
            view.setPoint(describePoint(e, lastMiss)); lastMiss = null;
          }
          if (tut) { // 튜토리얼: 단계 진행·코치 패널 갱신. 결과는 기록하지 않는다
            if (['serve', 'return', 'missed', 'point'].includes(e.type)) {
              const r = tut.handle(e); enterTutMatchup();
              view.setCoach(r.view); view.setShotHint(r.view.hint.button ?? null); view.setCoachDiagram(DIAGRAM_FOR_STEP[r.view.id] ?? null); // 눌러야 할 샷 버튼 반짝 + 설명 그림
              if (r.completed) {
                tutorialStore.complete();
                later(() => { if (loop === token) api.showTutorialDone(opts); }, 1500);
              }
            }
            if (e.type === 'end' && !tut.completed) later(() => { if (loop === token) api.startMatch({ ...opts, tutInstance: tut }); }, 1200); // 경기가 끝나 버리면 같은 진행으로 새 경기
            return;
          }
          if (e.type === 'end' && train) { // 훈련 경기: 시즌·순위·기록에 반영하지 않고 소액 포인트만 (승리 시)
            const won = e.winner === 'me'; const gained = trainingReward(won);
            state.statPoints += gained;
            if (won) addGrowth(state, ensureRogue(state).growthDir, 1); // 성장 줄기: 훈련 승리 = 고른 방향 +1칸
            persist();
            const summary = tally.summary();
            later(() => { if (loop === token) api.showResult({ won, score: e.score, gained, training: true, summary }); }, 800);
            return;
          }
          if (e.type === 'end') {
            const won = e.winner === 'me';
            const br = state.bracket?.final; const isFinal = stage === 'tournament' && !!br && br.winner === null && (br.a === 0 || br.b === 0); // 리그를 가르는 결승인가
            const story = storyOn() && opp.rival ? rivalPostMatch(state, opp, won, { final: isFinal }) : null; // 라이벌전: 승패 대사 (진 횟수도 센다 — 아래 persist 로 저장)
            // 결과 반영은 경기당 정확히 1회 (end 이벤트는 1회만 발생)
            const rng = createRng((Date.now() ^ (state.week * 7919)) >>> 0);
            const summary = tally.summary(); addMatchToTally(state, summary); // 시즌 결산 집계: 이 경기가 시즌을 끝내는 경기여도 결산에 포함되도록 결과 반영 전에
            const { gained, recap, rivalPt = 0 } = applyMine(won, e.score, rng);
            persist(); ads.noteMatchPlayed();
            const { records, broken } = recordsStore.apply(summary, { won });
            later(() => { if (loop === token) api.showResult({ won, score: e.score, gained, story, recap, summary, records, broken, cup: stage === 'cup', revenge: stage === 'revenge', rivalPt }); }, 800);
          }
        },
      });
      let tutMatchup = false;
      const enterTutMatchup = () => { if (tutMatchup || !tut?.step?.matchup) return; tutMatchup = true; ctl.configure({ useMatchup: true, oppParams: TRAINER_PICK_PARAMS }); view.setRps(true); }; // 튜토리얼 후반: 상성 적용 + 구질을 섞는 코치
      const tipper = createTipper({ store: tipsStore, enabled: () => !tut && !guide.active && settings.get().tips, tips: tipsFor(mode) });
      if (tut) { enterTutMatchup(); view.setCoach(tut.view); view.setShotHint(tut.view.hint.button ?? null); view.setCoachDiagram(DIAGRAM_FOR_STEP[tut.view.id] ?? null); } // 첫 단계 안내
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
          step: `${i + 1}/${pages.length}`, target: pages[i].target ?? null, title: pages[i].title, text: pages[i].text + livePick(pages[i]), last: i === pages.length - 1,
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
        if (!view.guideOpen) ctl.update(now); // 안내가 떠 있는 동안은 경기 로직을 아예 돌리지 않는다 (시계 정지와 이중 안전장치)
        if (liveTicker) { const v = liveTicker.update(nowFn() - startedAt - clock.pausedFor()); if (v) view.setTicker(v); } // 다른 경기 속보 (안내로 멈춘 시간은 뺀다)
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
        const inKey = mode === 'simple' && (!tut || tutMatchup) && situation === 'incoming' && ctl.flight ? shotKeyOfSpin(ctl.flight.spin) : null;
        const hidden = inKey && ctl.spinHidden(now); // 구질 위장(상위 리그): 타구 직후엔 종류를 알려주지 않는다
        view.setIncoming(inKey && !hidden ? incomingLabel(inKey, { counter: !!tut || !learn.done }) : '', hidden ? null : inKey); // 카운터를 15번 해 보기 전까지: 칩에 '커트 → 탑스핀 유리' 글자 힌트
        // 버튼 반짝임(반사 암기를 부르므로)은 첫 경기 안내가 진행 중일 때만. 평소 힌트는 위 글자 (튜토리얼은 단계별 힌트가 따로 있다)
        if (!tut && mode === 'simple') {
          const want = inKey && !hidden && guide.active ? counterOf(inKey) : null;
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
    /** 멀티플레이 로비: 방 만들기 / 로비 목록에서 방 선택. 연결·시계 동기화가 끝나면 바로 경기 시작 */
    showMultiplayer(opts = {}) {
      loop = null; bgm.play('title');
      let session = null; let ident = null;
      const dropSession = (reason) => { const s = session; session = null; if (s) s.close(reason); };
      const T = deps.netTimers ?? { setInterval: (f, ms) => setInterval(f, ms), clearInterval: (i) => clearInterval(i), setTimeout: (f, ms) => setTimeout(f, ms) };
      const nickStore = store.storage ?? globalThis.localStorage;
      const loadNick = () => { try { return nickStore.getItem(NICK_KEY) || ''; } catch { return ''; } }; // 옛 입력값(닉네임 정하기 칸 미리 채움용)
      const loadLocked = () => { // 잠긴 닉네임 {nick, uid}. 옛 버전에서 이미 선점해 둔 닉네임이 있으면 그것으로 잠근다
        try {
          const j = JSON.parse(nickStore.getItem(LOCK_KEY) || 'null'); if (j && typeof j.nick === 'string' && j.nick) return j;
          const c = nickStore.getItem(CLAIMED_KEY); if (c) return { nick: c, uid: null };
        } catch { /* 무시 */ }
        return null;
      };
      let locked = loadLocked();
      let poll = null; let listing = false;
      const stopPoll = () => { if (poll != null) { T.clearInterval(poll); poll = null; } };
      const refreshRooms = async () => { // 로비 목록: 메뉴를 보고 있을 때만 갱신
        if (listing || session || view.mode !== 'friends') return;
        listing = true;
        try { const r = (deps.roomFactory ?? (() => new FirebaseRoom()))(); view.setRooms((await r.listRooms()).filter((x) => !x.quick)); } // 빠른 대전 방은 친구 방 목록에 안 보인다
        catch { view.setRooms(null, true); }
        finally { listing = false; }
      };
      const factory = () => (deps.roomFactory ?? (() => new FirebaseRoom()))();
      // 신원: Firebase 익명 로그인 uid (불가하면 기기 ID). 주입된 방 팩토리(테스트·QA)에선 네트워크 로그인을 시도하지 않는다
      const identity = async () => (ident ??= await (deps.identity ? deps.identity() : resolveIdentity({ signIn: deps.roomFactory ? null : anonymousUid, storage: nickStore })));
      let starting = false; let quickTok = null;
      const view = multiScreen({
        nick: locked?.nick ?? '', prefill: loadNick(),
        onSetNick: (n) => setupNick(n),
        onHost: (title, pw) => { stopPoll(); go('host', { title, pw }); },
        onPick: (code, pw) => { stopPoll(); go('guest', { code, pw }); },
        onQuick: () => { stopPoll(); quick(); },
        onFriends: () => startPoll(),
        onHub: () => stopPoll(),
        onRefresh: () => { view.setRooms(null); refreshRooms(); },
        onCancel: () => { quickTok = null; starting = false; dropSession('cancel'); view.setMode('menu'); if (view.mode === 'friends') startPoll(); },
        onBack: () => { quickTok = null; stopPoll(); dropSession('cancel'); api.showTitle(); },
      });
      const startPoll = () => { stopPoll(); view.setRooms(null); refreshRooms(); poll = T.setInterval(refreshRooms, 5000); };
      const errText = (e) => {
        const m = String(e?.message ?? e);
        return m === 'room-not-found' ? '그 방이 없어졌어요. 목록을 새로고침해 주세요.'
          : m === 'bad-password' ? '비밀번호가 달라요.'
          : m === 'firebase-not-configured' ? '멀티플레이 서버 설정이 없어요.'
          : m === 'connect-timeout' ? '연결 시간이 초과됐어요. 다시 시도해 주세요.' : '연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.';
      };
      const toMenu = (message) => { view.setMode('menu', { message }); if (view.mode === 'friends') startPoll(); };
      /** 닉네임 정하기(첫 진입 1회): 먼저 등록한 사람이 임자(대소문자·공백 무시). 성공하면 잠가서 바꿀 수 없다 */
      async function setupNick(raw) {
        if (locked || starting) return;
        const nick = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 12);
        if (nick.length < 2) { view.setMode('menu', { message: '닉네임은 2자 이상으로 정해 주세요.' }); return; }
        starting = true; view.setMode('menu', { message: '' });
        let id; try { id = await identity(); } catch { id = { uid: 'unknown' }; }
        let st = 'ok';
        try { const r = factory(); if (r.claimNick) st = await r.claimNick(nick, id.uid); } catch (e) { starting = false; view.setMode('menu', { message: errText(e) }); return; }
        starting = false;
        if (st !== 'ok') { view.setMode('menu', { message: `‘${nick}’ 은(는) 이미 다른 사람이 쓰고 있어요. 다른 닉네임을 써 주세요.` }); return; }
        locked = { nick, uid: id.uid };
        try { nickStore.setItem(LOCK_KEY, JSON.stringify(locked)); nickStore.setItem(NICK_KEY, nick); } catch { /* 무시 */ }
        view.lockNick(nick); view.setMode('menu', { message: '' });
      }
      /** 잠긴 닉네임과 uid (uid 가 아직 없으면 지금 신원으로) */
      const whoAmI = async () => { let uid = locked.uid; if (!uid) { try { uid = (await identity()).uid; } catch { uid = 'unknown'; } } return { nick: locked.nick, uid }; };
      /** 방 만들기/입장 진입점: 입력 검사 → begin */
      async function go(role, { title = '', code = '', pw = '' }) {
        if (session || starting || !locked) return;
        const pc = checkPassword(pw);
        if (role === 'host' && !pc.ok) { toMenu(pc.error); return; }
        starting = true; audio.unlock();
        view.setMode(role === 'host' ? 'hosting' : 'joining', { title: String(title).slice(0, 20) || '탁구 한판', locked: !!pc.password });
        const who = await whoAmI();
        starting = false;
        await begin(role, { code, title, nick: who.nick, uid: who.uid, password: role === 'host' ? pc.password : String(pw ?? '').trim() });
      }
      /** 빠른 대전(랜덤 매칭): 열려 있는 빠른 대전 방에 무작위로 들어가고, 없으면 내가 방을 열어 기다린다. 동시에 연 두 방은 '먼저 만든 방'이 이긴다 */
      async function quick() {
        if (session || starting || !locked) return;
        starting = true; audio.unlock(); view.setMode('matching');
        const tok = quickTok = {};
        const who = await whoAmI();
        starting = false;
        if (quickTok !== tok) return;
        const sched = T.setTimeout ?? ((f, ms) => setTimeout(f, ms));
        let hosted = false; let steps = 0;
        const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map(([, x]) => x);
        const step = async () => {
          if (quickTok !== tok) return;
          let rooms = []; try { rooms = await factory().listRooms(); } catch { /* 이번 턴은 건너뜀 */ }
          if (quickTok !== tok) return;
          const quicks = rooms.filter((r) => r.quick && !r.lock && r.uid !== who.uid);
          const mine = hosted && session?.code ? rooms.find((r) => r.code === session.code) : null;
          // 내 방이 있으면 나보다 먼저 만들어진 방만 후보 (내가 양보). 내 방이 없으면 전부 후보
          const cands = shuffle(hosted ? quicks.filter((r) => mine && quickBefore(r, mine) < 0) : quicks);
          if (cands.length) {
            if (hosted) { dropSession('cancel'); hosted = false; }
            for (const c of cands) {
              const ok = await begin('guest', { code: c.code, nick: who.nick, uid: who.uid, password: '', quiet: true });
              if (quickTok !== tok) return;
              if (ok) { quickTok = null; return; } // 연결됨: 이후 시계 맞추기·경기 시작은 세션이 진행
            }
          }
          if (!hosted && !session) hosted = await begin('host', { title: '랜덤 대전', nick: who.nick, uid: who.uid, password: '', quick: true, quiet: true });
          if (quickTok !== tok) return;
          if (++steps >= QUICK_MAX_STEPS) { quickTok = null; dropSession('cancel'); toMenu('지금 대전 상대가 없어요. 잠시 뒤에 다시 눌러 보세요.'); return; }
          sched(step, QUICK_POLL_MS);
        };
        step();
      }
      /** 세션 시작. 성공(방 열림/입장 연결)이면 true. quiet 이면 실패해도 메뉴로 돌아가지 않는다 (빠른 대전이 다음 수를 둔다) */
      async function begin(role, { code = '', title = '', nick, uid = '', password = '', quick: isQuick = false, quiet = false }) {
        if (session) return false;
        const room = factory();
        const s = createNetSession({
          room, role, name: nick, nowFn, timers: deps.netTimers,
          onPhase: (p) => { if (session === s && p === 'syncing') view.setMode('syncing'); },
          onStart: (info, sess) => { quickTok = null; stopPoll(); if (session === s) session = null; api.startNetMatch({ session: sess, ...info }); }, // 첫 경기와 다시 하기 모두
          onRematch: () => api.netResultView?.setStatus(api.netRematchMine ? 'wait' : 'asked'),
          onGame: (msg) => api.netInbound(msg),
          onEnd: (reason) => {
            if (session === s) { session = null; quickTok = null; toMenu(reason === 'disconnected' || reason === 'peer-left' || reason === 'timeout' ? '연결이 끊겼어요.' : ''); }
            else api.netEnded?.(reason, s); // 경기 중·결과 화면에서 끊김
          },
        });
        session = s;
        try {
          if (role === 'host') {
            const roomTitle = String(title).slice(0, 20) || '탁구 한판';
            view.setMode(isQuick ? 'matching' : 'hosting', { title: roomTitle, locked: !!password });
            await s.host(title, { password, quick: isQuick, uid });
          } else { view.setMode(quiet ? 'matching' : 'joining'); await s.join(code, undefined, { password }); if (!quiet) view.setMode('syncing'); }
          return true;
        } catch (e) {
          if (session === s) { session = null; try { s.close('error'); } catch { /* 무시 */ } if (!quiet) toMenu(errText(e)); }
          return false;
        }
      }
      if (opts.message) view.setMode('menu', { message: opts.message });
      mount(view.el, () => view.back());
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
      backFn = () => { later(() => view.quit(), 0); return true; };
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
