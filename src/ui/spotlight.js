// 스포트라이트(하이라이트 박스) 공용: 대상 요소 둘레에 구멍을 내고 나머지를 어둡게 한다. 가이드 투어(홈)와 첫 경기 안내가 함께 쓴다.
// getBoundingClientRect 가 크기를 주지 않는 환경(테스트 스텁)에서는 구멍 없이 전체를 어둡게만 한다.
const PAD = 6;

/** hole 의 위치·크기를 target 에 맞추고, 카드(card)는 대상이 있는 반대쪽(위/아래)에 둔다. 구멍을 만들었으면 true */
export function placeSpotlight({ hole, card, target, pad = PAD }) {
  const r = target?.getBoundingClientRect?.();
  const vh = globalThis.innerHeight || 0;
  if (!r || !(r.width > 0) || !(r.height > 0)) { hole.className = 'spot-hole off'; hole.setAttribute('style', ''); card?.setAttribute('data-pos', 'high'); return false; }
  hole.className = 'spot-hole';
  hole.setAttribute('style', `left:${Math.round(r.left - pad)}px;top:${Math.round(r.top - pad)}px;width:${Math.round(r.width + pad * 2)}px;height:${Math.round(r.height + pad * 2)}px`);
  card?.setAttribute('data-pos', vh && r.top + r.height / 2 < vh / 2 ? 'low' : 'high'); // 대상이 위쪽에 있으면 카드는 아래, 아래쪽이면 위
  return true;
}

/** root 안에서 data-tour="id" 요소 찾기 (브라우저: querySelector, 스텁: 트리 순회) */
export function findTourTarget(root, id) {
  if (root.querySelector) return root.querySelector(`[data-tour="${id}"]`);
  const walk = (n) => { if (n.attrs?.['data-tour'] === id) return n; for (const c of n.children ?? []) { const f = walk(c); if (f) return f; } return null; };
  return walk(root);
}

/**
 * 가이드 투어: steps = [{ id, text }] — id 는 화면 요소의 data-tour. 대상이 없는 단계는 건너뛴다.
 * 오버레이는 root 안에 붙으므로 화면이 바뀌면(mount) 함께 사라진다. 끝나면 onDone(skipped).
 */
export function startTour(root, steps, { onDone = () => {} } = {}) {
  const list = steps.filter((s) => findTourTarget(root, s.id));
  if (!list.length) { onDone(false); return null; }
  const hole = h_('div', { class: 'spot-hole off' });
  const stepEl = h_('small', { class: 'tour-step' }); const textEl = h_('p', { class: 'tour-text' });
  const next = h_('button', { class: 'btn primary tour-next', type: 'button' }, '다음');
  const skip = h_('button', { class: 'btn tour-skip', type: 'button' }, '건너뛰기');
  const card = h_('div', { class: 'tour-card', 'data-pos': 'high' }, stepEl, textEl, h_('div', { class: 'tour-btns' }, skip, next));
  const el = h_('div', { class: 'tour', role: 'dialog', 'aria-live': 'polite' }, hole, card);
  let i = 0; let done = false;
  const target = () => findTourTarget(root, list[i].id);
  const show = () => {
    const t = target(); t?.scrollIntoView?.({ block: 'center', behavior: 'instant' });
    stepEl.textContent = `${i + 1}/${list.length}`; textEl.textContent = list[i].text; next.textContent = i === list.length - 1 ? '끝' : '다음';
    el.className = placeSpotlight({ hole, card, target: t }) ? 'tour' : 'tour nohole';
  };
  const finish = (skipped) => {
    if (done) return; done = true;
    globalThis.removeEventListener?.('resize', show); globalThis.removeEventListener?.('scroll', show, true);
    if (el.parent) el.parent.removeChild(el);
    onDone(skipped);
  };
  next.addEventListener('click', () => { if (++i < list.length) show(); else finish(false); });
  skip.addEventListener('click', () => finish(true));
  root.appendChild(el);
  show();
  globalThis.addEventListener?.('resize', show); globalThis.addEventListener?.('scroll', show, true);
  return { el, finish };
}

function h_(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
  for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
