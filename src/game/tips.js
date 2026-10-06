// 첫 플레이 힌트: 상황이 처음 나올 때만 짧게 보여준다. 본 힌트는 저장되어 다시 나오지 않는다.
export const TIPS_KEY = 'tabgu-king-tips-v1';

/** 순서가 있는 힌트: 앞 힌트를 본 뒤에야 다음 힌트가 나온다 (한 번에 하나) */
export const TIPS = Object.freeze([
  { id: 'serve', when: 'awaitServe', text: '화면을 탭하면 서브해요' },
  { id: 'zone', when: 'incoming', text: '노란 띠 안에서 탭! 가운데(붉은 띠)가 PERFECT' },
  { id: 'course', when: 'incoming', text: '탭하는 위치(왼쪽·가운데·오른쪽)로 공을 보낼 코스를 정해요' },
  { id: 'spin', when: 'incoming', text: '탭하면서 위로 쓸면 탑스핀(빠르고 낮게), 아래로 쓸면 커트(느리고 높게)' },
  { id: 'power', when: 'incoming', text: '길게 쓸수록 강한 샷! 너무 세면 아웃, 약하면 네트' },
]);
// 간단 조작용 힌트 (쓸기 없음): 서브 → 띠에서 탭 → 코스(탭 위치) → 샷 선택 버튼
export const TIPS_SIMPLE = Object.freeze([
  { id: 'serve', when: 'awaitServe', text: '화면을 탭하면 서브해요' },
  { id: 'zone', when: 'incoming', text: '공이 노란 띠에 들어오면 탭! 가운데(붉은 띠)가 PERFECT' },
  { id: 'course', when: 'incoming', text: '탭하는 위치로 공을 보내요: 왼쪽 탭 → 왼쪽, 오른쪽 탭 → 오른쪽' },
  { id: 'shot', when: 'incoming', text: '아래 버튼으로 샷을 골라요: 탑스핀=빠르고 낮게, 커트=느리고 높게' },
]);
export const tipsFor = (mode) => (mode === 'advanced' ? TIPS : TIPS_SIMPLE);
const ALL_TIP_IDS = new Set([...TIPS, ...TIPS_SIMPLE].map((t) => t.id));
export const TIP_SHOW_SECONDS = 3.2;

export function createTipsStore(storage = globalThis.localStorage) {
  let seen = new Set();
  try { const raw = JSON.parse(storage?.getItem(TIPS_KEY) ?? '[]'); if (Array.isArray(raw)) seen = new Set(raw.filter((x) => ALL_TIP_IDS.has(x))); } catch { seen = new Set(); }
  return {
    has: (id) => seen.has(id),
    add(id) { seen.add(id); try { storage?.setItem(TIPS_KEY, JSON.stringify([...seen])); } catch { /* 무시 */ } },
    clear() { seen = new Set(); try { storage?.removeItem(TIPS_KEY); } catch { /* 무시 */ } },
    get size() { return seen.size; },
  };
}

/**
 * 힌트 진행기. update(situation, now) → 지금 보여줄 힌트 {id,text} 또는 null.
 * situation: 'awaitServe' | 'incoming'(내가 받을 공이 날아오는 중, 존 열림) | 그 외(null)
 * 규칙: 같은 상황 종류에서 아직 안 본 첫 힌트를 TIP_SHOW_SECONDS 동안 보여주고 '본 것'으로 저장.
 *       'incoming' 힌트는 공 하나당 하나만(다음 공에서 다음 힌트). 서브 힌트는 서브하면 즉시 본 것으로 처리.
 */
export function createTipper({ store, enabled = () => true, tips = TIPS }) {
  let cur = null; // { tip, until }
  let lastIncomingKey = null;
  const finish = () => { if (cur) { store.add(cur.tip.id); cur = null; } };
  return {
    get current() { return cur?.tip ?? null; },
    /** 플레이어가 해당 행동을 했을 때(서브/탭) 호출: 보던 힌트를 본 것으로 확정 */
    acted() { finish(); },
    update(situation, now, incomingKey = null) {
      if (!enabled()) { cur = null; return null; }
      if (cur) {
        const sameKind = tips.find((t) => t.id === cur.tip.id)?.when === situation;
        if (now >= cur.until || !sameKind) finish(); else return cur.tip;
      }
      if (!situation) return null;
      if (situation === 'incoming') { if (incomingKey != null && incomingKey === lastIncomingKey) return null; }
      const next = tips.find((t) => t.when === situation && !store.has(t.id));
      if (!next) return null;
      if (situation === 'incoming') lastIncomingKey = incomingKey;
      cur = { tip: next, until: now + TIP_SHOW_SECONDS };
      return next;
    },
  };
}
