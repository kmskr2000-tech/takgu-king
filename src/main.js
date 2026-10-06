// 진입점. 배포본(window.__V 있음)은 version.json 과 비교해 낡은 캐시면 새 버전 URL 로 갈아탄다 (AGENTS.md 캐시 대책).
(async () => {
  const V = window.__V;
  const q = V ? `?v=${V}` : '';
  if (V) {
    try {
      const r = await fetch(`assets/version.json?t=${Date.now()}`, { cache: 'no-store' });
      const { v } = await r.json();
      if (v != null && String(v) !== String(V)) {
        const u = new URL(location.href);
        if (u.searchParams.get('v') !== String(v)) { // 이미 그 버전으로 왔다면 갈아타지 않음 → 무한루프 방지
          u.searchParams.set('v', v);
          location.replace(u.toString());
          return;
        }
      }
    } catch { /* 오프라인/실패: 현재 버전으로 계속 */ }
  }
  const { createApp } = await import(`./ui/app.js${q}`);
  const app = createApp(document.getElementById('app'));
  // 직접 링크: #rules(룰 설명) / #settings(설정) — 상태가 필요 없는 화면만. 인트로는 건너뛴다
  const hash = (typeof location !== 'undefined' && location.hash) || '';
  if (hash === '#rules') app.showRules();
  else if (hash === '#settings') app.showSettings();
  else app.start();
})();
