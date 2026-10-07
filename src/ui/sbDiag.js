// 진단용(2026-10-07): iOS 홈 화면 앱 상단 페이드 원인 가르기. 주소 뒤에 파라미터를 붙여 한 번 열면 저장되어 홈 화면 앱을 다시 열어도 유지된다. ?diag=off 로 전부 해제.
//   ?sb=default|black   상태바 메타(apple-mobile-web-app-status-bar-style). default 는 viewport-fit=cover 도 뺀다 (옛 동작)
//   ?vf=auto|cover      viewport-fit 만 따로 (auto = 노치·상태바 아래로 콘텐츠가 안 들어감)
//   ?tc=none|RRGGBB     theme-color 메타 제거 / 지정 (예: ?tc=000000)
//   ?info=1             상단 상태 표시(standalone 여부·안전영역·뷰포트 오프셋 등)를 화면에 띄움 — 스크린샷으로 원인 단서
// 사파리 탭은 viewport-fit·theme-color 가 즉시 반영되고, 홈 화면 앱은 상태바 메타가 앱을 다시 열 때 읽힌다(저장 값으로 다음 실행부터 적용).
export const SB_KEY = 'tabgu-king-sb-diag';
export const SB_MODES = Object.freeze(['default', 'black']);
const VF = ['auto', 'cover'];

export function parseDiag(search = '', saved = null) {
  const q = new URLSearchParams(search);
  if (q.get('diag') === 'off' || q.get('sb') === 'off') return {};
  const cur = { ...(saved ?? {}) };
  const sb = q.get('sb'); if (SB_MODES.includes(sb)) cur.sb = sb;
  const vf = q.get('vf'); if (VF.includes(vf)) cur.vf = vf;
  const tc = q.get('tc'); if (tc === 'none' || /^[0-9a-fA-F]{6}$/.test(tc ?? '')) cur.tc = tc;
  if (q.get('info') === '1') cur.info = true; else if (q.get('info') === '0') delete cur.info;
  return cur;
}

export function applySbDiag({ search = '', storage = null, doc = globalThis.document, env = globalThis } = {}) {
  let saved = null;
  let raw = null; try { raw = storage?.getItem(SB_KEY) ?? null; } catch { raw = null; }
  try { saved = JSON.parse(raw ?? 'null'); } catch { saved = SB_MODES.includes(raw) ? { sb: raw } : null; } // 옛 저장 형식: 문자열 한 단어
  const cfg = parseDiag(search, saved);
  try { if (Object.keys(cfg).length) storage?.setItem(SB_KEY, JSON.stringify(cfg)); else storage?.removeItem(SB_KEY); } catch { /* 무시 */ }
  const keys = Object.keys(cfg);
  if (!keys.length) return null;
  if (!doc?.querySelector) return cfg;
  const meta = (name) => doc.querySelector(`meta[name="${name}"]`);
  if (cfg.sb) meta('apple-mobile-web-app-status-bar-style')?.setAttribute('content', cfg.sb);
  const dropCover = cfg.vf ? cfg.vf === 'auto' : cfg.sb === 'default';
  const vp = meta('viewport');
  if (vp && dropCover) vp.setAttribute('content', (vp.getAttribute('content') ?? '').replace(/,?\s*viewport-fit=cover/, '').trim());
  if (cfg.tc) {
    const tm = meta('theme-color');
    if (cfg.tc === 'none') tm?.parentNode?.removeChild?.(tm); else tm?.setAttribute('content', `#${cfg.tc}`);
  }
  try {
    const tag = doc.createElement('div');
    tag.textContent = `진단 ${keys.map((k) => `${k}=${cfg[k]}`).join(' ')} (해제 ?diag=off)`;
    tag.style.cssText = 'position:fixed;left:0;right:0;bottom:2px;text-align:center;font:11px system-ui;color:#ffd24a;z-index:99999;pointer-events:none;text-shadow:0 1px 0 #000';
    doc.body?.appendChild(tag);
    if (cfg.info) showInfo(doc, env);
  } catch { /* 무시 */ }
  return cfg;
}

/** 상단 가운데에 측정값을 찍는다 (홈 화면 앱인지·안전영역·뷰포트가 상태바 아래에서 시작하는지) */
function showInfo(doc, env) {
  const probe = doc.createElement('div'); probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden';
  doc.body.appendChild(probe);
  const vv = env.visualViewport; const nav = env.navigator ?? {};
  const mm = (q) => { try { return env.matchMedia?.(q)?.matches ? 1 : 0; } catch { return '?'; } };
  const rows = () => [
    `standalone nav=${nav.standalone ?? '-'} mq=${mm('(display-mode: standalone)')}`,
    `safeTop=${probe.getBoundingClientRect?.().height ?? '?'} innerH=${env.innerHeight} screenH=${env.screen?.height} dpr=${env.devicePixelRatio}`,
    `vv.offTop=${vv?.offsetTop ?? '-'} vv.pageTop=${vv?.pageTop ?? '-'} vv.h=${vv?.height ?? '-'} scrollY=${env.scrollY}`,
  ].join('\n');
  const box = doc.createElement('pre');
  box.style.cssText = 'position:fixed;left:4px;right:4px;top:120px;margin:0;font:10px/1.3 ui-monospace,monospace;color:#9f9;background:rgba(0,0,0,.7);z-index:99999;pointer-events:none;white-space:pre-wrap';
  box.textContent = rows(); doc.body.appendChild(box);
  env.setInterval?.(() => { box.textContent = rows(); }, 1000);
}
