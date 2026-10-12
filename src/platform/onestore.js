// 원스토어 H5 SDK 연동 (https://onestore-dev.gitbook.io/dev/tools/web-sdk/lifecycle).
// 순서: createSDK → pause/resume/exit 리스너 → initializeAsync → setLoadingProgress → startGameAsync.
// 원스토어 밖(일반 브라우저·GitHub Pages·토스 등)이거나 SDK 를 못 불러오면 active=false 로 아무것도 하지 않아 게임은 기존대로 동작한다.
export const SDK_URL = 'https://h5sdk.onestore.net/lib/v1.1.0/onestore-h5-sdk.min.js';

const withTimeout = (p, ms, what) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`${what} timeout`)), ms);
  Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

/**
 * hooks: { pause(ev), resume(ev), exit(), back() → boolean } — init() 전에 둘 수 있고, 나중에 바꿔도 된다(늦게 바인딩).
 * load: SDK 모듈 로더(테스트용 주입). 기본은 URL 동적 import.
 */
export function createOneStoreBridge({ url = SDK_URL, load = (u) => import(/* webpackIgnore: true */ u), hooks = {}, loadTimeoutMs = 3000, initTimeoutMs = 15000, startTimeoutMs = 10000 } = {}) {
  let sdk = null; let active = false; let info = null;
  const call = (name, ...a) => { try { return hooks[name]?.(...a); } catch (e) { console.warn?.(`onestore hook ${name} 실패`, e); return undefined; } };
  return {
    hooks,
    get active() { return active; },
    get info() { return info; },
    /** 1~3단계. 원스토어 환경에서 초기화에 성공하면 true, 그 밖(미지원·로드 실패·초기화 실패)은 false → 호출한 쪽은 SDK 없이 진행 */
    async init() {
      try {
        const mod = await withTimeout(load(url), loadTimeoutMs, 'sdk load');
        sdk = mod.createSDK();
        // 리스너는 initializeAsync 전에: 초기화 직후 이벤트가 연달아 올 수 있다. 원스토어 밖에선 active=false 라 전달하지 않는다
        sdk.on('pause', (ev) => { if (active) call('pause', ev); });
        sdk.on('resume', (ev) => { if (active) call('resume', ev); });
        sdk.on('exit', () => { call('exit'); }); // 저장은 0.5초 안에 동기적으로 (exit 은 원스토어가 요청할 때만 오므로 active 와 무관하게 항상 저장)
        sdk.onBackPressed(() => (active && call('back') === true)); // 동기 함수: 앱은 200ms 안에 회신을 기다린다
        const res = await withTimeout(sdk.initializeAsync(), initTimeoutMs, 'sdk init');
        if (!res || res.err) return false; // { err: 'Platform Not Supported' }
        info = res; active = true;
        return true;
      } catch (e) {
        console.warn?.('원스토어 SDK 사용 안 함:', e?.reason ?? e?.message ?? e);
        active = false;
        return false;
      }
    },
    /** 4단계: 0~100 진행률 보고 (응답 없는 통지). 원스토어가 아니면 무시 */
    progress(n) { if (active) { try { sdk.setLoadingProgress(Math.max(0, Math.min(100, Number(n) || 0))); } catch { /* 무시 */ } } },
    /** 5단계: 로딩 완료 → 앱의 로딩 화면이 사라지고 게임이 보인다. 실패해도 게임은 계속 진행 */
    async start() {
      if (!active) return false;
      try { const r = await withTimeout(sdk.startGameAsync(), startTimeoutMs, 'sdk start'); return !r?.err; } catch (e) { console.warn?.('startGameAsync 실패', e?.reason ?? e?.message ?? e); return false; }
    },
  };
}
