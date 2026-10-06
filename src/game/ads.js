// 광고 훅 계층 (SDK 없음). 게임은 "자연스러운 끊김"에서 슬롯만 호출하고, 실제 광고는 provider 가 맡는다.
// provider 를 꽂기 전(기본)에는 아무 광고도 나오지 않고 게임 흐름은 한 치도 바뀌지 않는다.
//
// provider 인터페이스:  { name, ready(slotId) → boolean|undefined, prepare?(slotId), show(slotId) → Promise<{shown, rewarded?}> }
//   ready: true=준비됨 / false=없음 / undefined=모름(전면 광고는 시도해 본다. 보상형은 true 일 때만 제안)

export const AD_SLOTS = Object.freeze({
  afterMatch: { type: 'interstitial', name: 'after-match', label: '경기 종료 후 (결과 화면에서 계속)' },
  seasonEnd: { type: 'interstitial', name: 'season-end', label: '시즌 종료 후 (다음 시즌으로)' },
  titleReturn: { type: 'interstitial', name: 'title-return', label: '홈에서 타이틀로 돌아갈 때' },
  doublePoints: { type: 'rewarded', name: 'double-points', label: '보상형: 결과 화면에서 포인트 2배' },
});

export const DEFAULT_POLICY = Object.freeze({
  noAdsBeforeMatches: 2, // 평생 누적 경기 수가 이보다 적으면 전면 광고 없음 (처음 경험 보호)
  minSecondsBetween: 180, // 마지막 광고 이후 최소 시간
  minMatchesBetween: 3, // 마지막 광고 이후 최소 경기 수
  maxPerSession: 8, // 한 번 실행에서 전면 광고 최대 횟수
  showTimeoutMs: 60000, // provider 가 이 시간 안에 끝나지 않으면 게임을 계속 진행
});

export function createNullProvider() {
  return { name: 'none', ready: () => false, prepare() {}, show: async () => ({ shown: false }) };
}

const ADS_KEY = 'tabgu-king-ads-v1';

/**
 * 광고 관리자: 노출 정책(빈도 제한·무광고·동의)과 안전한 진행(타임아웃·예외·한 번만 next)을 책임진다.
 * nowFn: 초 단위 실시간. schedule: 테스트용 타이머 주입.
 */
export function createAdManager({
  provider = createNullProvider(), policy = {}, nowFn = () => Date.now() / 1000, storage = null,
  enabled = () => true, consent = () => true, onEvent = () => {},
  schedule = (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); },
} = {}) {
  const P = { ...DEFAULT_POLICY, ...policy };
  let adFree = false;
  let lifetimeMatches = 0;
  try { lifetimeMatches = Math.max(0, Number(JSON.parse(storage?.getItem(ADS_KEY) ?? '{}').matches) || 0); } catch { lifetimeMatches = 0; }
  const persist = () => { try { storage?.setItem(ADS_KEY, JSON.stringify({ matches: lifetimeMatches })); } catch { /* 무시 */ } };
  let lastShownAt = null; let matchesSinceAd = Infinity; let sessionShown = 0; let busy = false;
  const emit = (e) => { try { onEvent(e); } catch { /* 훅 오류가 게임을 막지 않게 */ } };

  const api = {
    get provider() { return provider; },
    get adFree() { return adFree; },
    get lifetimeMatches() { return lifetimeMatches; },
    get sessionShown() { return sessionShown; },
    setAdFree(v) { adFree = !!v; }, // 나중에 '광고 제거' 구매가 생기면 여기로
    setProvider(p) { provider = p ?? createNullProvider(); },
    /** 경기가 하나 끝났을 때(튜토리얼·연습 제외) 호출 */
    noteMatchPlayed() { lifetimeMatches += 1; if (matchesSinceAd !== Infinity) matchesSinceAd += 1; persist(); },

    /** 전면 광고를 지금 보여줘도 되는가 → { ok, reason } */
    canShow(slotId) {
      const slot = AD_SLOTS[slotId];
      if (!slot || slot.type !== 'interstitial') return { ok: false, reason: 'unknown-slot' };
      if (!enabled() || adFree) return { ok: false, reason: 'disabled' };
      if (!consent()) return { ok: false, reason: 'no-consent' };
      if (busy) return { ok: false, reason: 'busy' };
      if (provider.ready(slotId) === false) return { ok: false, reason: 'not-ready' };
      if (lifetimeMatches < P.noAdsBeforeMatches) return { ok: false, reason: 'too-early' };
      if (sessionShown >= P.maxPerSession) return { ok: false, reason: 'session-cap' };
      if (lastShownAt != null && nowFn() - lastShownAt < P.minSecondsBetween) return { ok: false, reason: 'too-soon' };
      if (matchesSinceAd < P.minMatchesBetween) return { ok: false, reason: 'too-few-matches' };
      return { ok: true, reason: 'ok' };
    },

    /** 보상형 제안을 해도 되는가 (사용자가 직접 누르는 것이라 빈도 제한 없음, 준비됨이 확실할 때만) */
    canOfferReward(slotId) {
      const slot = AD_SLOTS[slotId];
      return !!slot && slot.type === 'rewarded' && enabled() && !adFree && consent() && !busy && provider.ready(slotId) === true;
    },
    prepare(slotId) { try { provider.prepare?.(slotId); } catch { /* 무시 */ } },

    _run(slotId) { // provider.show 를 타임아웃·예외로부터 보호
      busy = true; emit({ type: 'start', slot: slotId });
      return new Promise((resolve) => {
        let done = false; let cancel = () => {};
        const finish = (r) => {
          if (done) return; done = true; cancel(); busy = false;
          const res = { shown: !!r?.shown, rewarded: !!r?.rewarded, reason: r?.reason ?? (r?.shown ? 'ok' : 'no-fill') };
          emit({ type: 'end', slot: slotId, ...res }); resolve(res);
        };
        cancel = schedule(() => finish({ shown: false, reason: 'timeout' }), P.showTimeoutMs);
        try { Promise.resolve(provider.show(slotId)).then(finish, () => finish({ shown: false, reason: 'error' })); } catch { finish({ shown: false, reason: 'error' }); }
      });
    },

    async show(slotId) {
      const c = api.canShow(slotId);
      if (!c.ok) return { shown: false, rewarded: false, reason: c.reason };
      const r = await api._run(slotId);
      if (r.shown) { lastShownAt = nowFn(); matchesSinceAd = 0; sessionShown += 1; }
      return r;
    },

    /** 보상형: 사용자가 버튼을 눌렀을 때 호출. 보상 받았으면 rewarded:true */
    async offerRewarded(slotId) {
      if (!api.canOfferReward(slotId)) return { shown: false, rewarded: false, reason: 'not-ready' };
      return api._run(slotId);
    },

    /**
     * 자연스러운 끊김에서 쓰는 도우미: 광고가 가능하면 보여주고, 끝나면 next() — 불가능하면 즉시(동기) next().
     * next 는 어떤 경우에도 정확히 한 번만 호출된다.
     */
    runBreak(slotId, next) {
      let called = false;
      const once = () => { if (called) return; called = true; next(); };
      if (!api.canShow(slotId).ok) { once(); return false; }
      api.show(slotId).then(once, once);
      return true;
    },
  };
  return api;
}

/**
 * Google Ad Placement API(`adBreak()`) 어댑터 — 공식 문서 기준.
 * 일반 브라우저/WebView/Custom Tab 에서 동작하며, Google Mobile Ads SDK 가 붙은 안드로이드 앱의 WebView 에서는 AdMob 으로 이어진다.
 * 페이지에 AdSense 태그(`adsbygoogle.js`)와 `window.adBreak = function(o){ adsbygoogle.push(o) }` 가 있어야 동작한다.
 * 전면: type 'next' (beforeAd/afterAd 는 적합한 광고가 있을 때만 호출됨 → startGraceMs 안에 시작 안 하면 광고 없음으로 간주)
 * 보상: type 'reward' (beforeReward 로 showAdFn 을 받아 두었다가 사용자 클릭 안에서 호출)
 */
export function createAdBreakProvider(win = globalThis, { startGraceMs = 1500, schedule = (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } } = {}) {
  const rewardFns = new Map();
  const has = () => typeof win?.adBreak === 'function';
  return {
    name: 'adBreak',
    ready(slotId) {
      if (!has()) return false;
      return AD_SLOTS[slotId]?.type === 'rewarded' ? rewardFns.has(slotId) : undefined; // 전면은 시도해 봐야 안다
    },
    /** 보상형은 미리 adBreak() 를 걸어 두고, 광고가 있으면 beforeReward 에서 showAdFn 을 받는다 (기회마다 새로 호출) */
    prepare(slotId) {
      const slot = AD_SLOTS[slotId];
      if (!has() || slot?.type !== 'rewarded') return;
      rewardFns.delete(slotId);
      win.adBreak({ type: 'reward', name: slot.name, beforeReward: (showAdFn) => { rewardFns.set(slotId, showAdFn); } });
    },
    show(slotId) {
      const slot = AD_SLOTS[slotId];
      if (!has() || !slot) return Promise.resolve({ shown: false });
      return new Promise((resolve) => {
        let started = false; let viewed = false; let cancelGrace = () => {};
        const end = () => { cancelGrace(); resolve({ shown: started, rewarded: viewed }); };
        if (slot.type === 'rewarded') {
          const showAdFn = rewardFns.get(slotId);
          if (!showAdFn) { resolve({ shown: false }); return; }
          rewardFns.delete(slotId);
          win.adBreak({
            type: 'reward', name: slot.name,
            beforeAd: () => { started = true; }, adViewed: () => { viewed = true; }, adDismissed: () => {}, afterAd: end,
          });
          showAdFn(); // 사용자 클릭 안에서 호출되어야 한다
          return;
        }
        cancelGrace = schedule(() => { if (!started) resolve({ shown: false }); }, startGraceMs); // 광고가 없으면 콜백이 오지 않는다
        win.adBreak({ type: 'next', name: slot.name, beforeAd: () => { started = true; cancelGrace(); }, afterAd: end });
      });
    },
  };
}

/** 페이지에 adBreak 가 있으면 그것을, 없으면 '광고 없음' provider 를 쓴다 */
export const providerFromWindow = (win = globalThis) => (typeof win?.adBreak === 'function' ? createAdBreakProvider(win) : createNullProvider());
