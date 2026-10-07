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
  try { const { applySbDiag } = await import(`./ui/sbDiag.js${q}`); applySbDiag({ search: location.search, storage: globalThis.localStorage }); } catch { /* 진단 실패는 무시 */ } // ?sb=default 진단(상태바 불투명)
  const hash = (typeof location !== 'undefined' && location.hash) || '';
  // QA 직접 링크(#qa-…): 메모리 저장소로만 동작하는 정지 화면 (실제 저장 데이터 불변). 일반 사용자는 이 모듈을 불러오지 않는다
  if (hash.startsWith('#qa-')) {
    const { mountQa } = await import(`./ui/qa.js${q}`);
    if (mountQa(document.getElementById('app'), hash.slice(4))) return;
  }
  const { createApp } = await import(`./ui/app.js${q}`);
  const app = createApp(document.getElementById('app'));
  // 직접 링크: #rules(룰 설명) / #settings(설정) — 상태가 필요 없는 화면만. 인트로는 건너뛴다
  if (hash === '#rules') app.showRules();
  else if (hash === '#settings') app.showSettings();
  else app.start();
})();
