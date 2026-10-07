// 진단용(2026-10-07): iOS 상단 페이드 원인 가르기. 주소 뒤에 ?sb=default 를 붙이면
//  - apple-mobile-web-app-status-bar-style 을 default(불투명 상태바)로 바꾸고
//  - viewport-fit=cover 를 빼서(auto) 콘텐츠가 상태바·노치 아래로 들어가지 않게 한다.
// ?sb=black 은 black(불투명 검정), ?sb=off 는 진단 해제(원래대로). 한 번 켜면 저장되어 홈 화면 앱을 다시 열어도 유지된다.
// 사파리 탭에서는 viewport-fit 만 효과가 있고, 홈 화면 앱은 상태바 메타가 앱을 다시 열 때 읽히므로 저장 값으로 다음 실행부터 적용된다.
export const SB_KEY = 'tabgu-king-sb-diag';
export const SB_MODES = Object.freeze(['default', 'black']);

export function applySbDiag({ search = '', storage = null, doc = globalThis.document } = {}) {
  let mode = null;
  try {
    const p = new URLSearchParams(search).get('sb');
    if (p === 'off') storage?.removeItem(SB_KEY);
    else if (SB_MODES.includes(p)) storage?.setItem(SB_KEY, p);
    const saved = p === 'off' ? null : (SB_MODES.includes(p) ? p : storage?.getItem(SB_KEY));
    mode = SB_MODES.includes(saved) ? saved : null;
  } catch { mode = SB_MODES.includes(new URLSearchParams(search).get('sb')) ? new URLSearchParams(search).get('sb') : null; }
  if (!mode || !doc?.querySelector) return mode;
  const bar = doc.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (bar) bar.setAttribute('content', mode);
  const vp = doc.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', (vp.getAttribute('content') ?? '').replace(/,?\s*viewport-fit=cover/, '').trim());
  try { // 진단 중임을 화면 아래에 작게 표시 (스크린샷으로 어떤 모드인지 알 수 있게)
    const tag = doc.createElement('div');
    tag.textContent = `진단 sb=${mode} (해제: ?sb=off)`;
    tag.style.cssText = 'position:fixed;left:0;right:0;bottom:2px;text-align:center;font:11px system-ui;color:#ffd24a;z-index:99999;pointer-events:none;text-shadow:0 1px 0 #000';
    doc.body?.appendChild(tag);
  } catch { /* 무시 */ }
  return mode;
}
