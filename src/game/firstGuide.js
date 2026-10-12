// 첫 경기 안내: 처음 하는 본 경기(튜토리얼 제외)에서 중요한 순간마다 경기를 멈추고 조작법을 단계별로 설명한다.
// DOM·시간 무관, 순수 로직. 트리거: 'serve'(내 서브 차례) / 'incoming'(첫 공이 튕겨 띠가 나타난 직후). 각 트리거는 평생 한 번.
export const GUIDE_KEY = 'tabgu-king-firstguide-v1';
export const GUIDE_TRIGGERS = Object.freeze(['serve', 'incoming']);

/** 조작 방식별 안내 페이지. 한 트리거에 여러 페이지면 같은 멈춤 안에서 차례로 넘긴다 */
export const GUIDE_PAGES = Object.freeze({
  simple: {
    serve: [
      { id: 'serve', target: 'shotbar', title: '서브', text: '[일반][탑스핀][커트] 중 하나를 누르면\n서브! 누르는 순간이 스윙이에요.' },
      { id: 'course', target: 'court', title: '코스', text: '코트를 탭해 공이 갈\n왼쪽·가운데·오른쪽을 정해요.' },
    ],
    incoming: [
      { id: 'bands', target: 'court', title: '띠', text: '공이 띠 안에 있을 때 버튼!\n빨강 탑스핀 · 노랑 일반 · 파랑 커트' },
      { id: 'perfect', target: 'court', title: 'PERFECT', text: '띠 한가운데 줄에 맞추면\n더 강하고 정확해요.' },
      { id: 'pick', target: 'incoming', title: '상성', text: '탑스핀 > 커트 > 일반 > 탑스핀\n이기는 버튼이 반짝여요.' },
    ],
  },
  advanced: {
    serve: [
      { id: 'serve', target: 'court', title: '서브', text: '화면을 탭하면 서브!\n탭한 자리가 코스예요.' },
    ],
    incoming: [
      { id: 'bands', target: 'court', title: '띠', text: '공이 띠 안에 있을 때 탭!' },
      { id: 'perfect', target: 'court', title: 'PERFECT', text: '띠 한가운데 줄에 맞추면\n더 강하고 정확해요.' },
      { id: 'swipe', target: 'court', title: '쓸기', text: '탭 직후 위로 쓸면 탑스핀,\n아래로 커트, 길수록 강해요.' },
    ],
  },
});

/** 안내가 이미 설명한 일반 힌트(tips.js id): 안내를 본 뒤 다음 경기에서 같은 내용을 한 공씩 또 설명하지 않게 본 것으로 처리 */
export const GUIDE_COVERS = Object.freeze({
  simple: { serve: ['serve', 'course'], incoming: ['zone', 'shot', 'matchup', 'course'] },
  advanced: { serve: ['serve'], incoming: ['zone', 'course', 'spin', 'power'] },
});

export function createGuideStore(storage = globalThis.localStorage) {
  let seen = new Set();
  try { const raw = JSON.parse(storage?.getItem(GUIDE_KEY) ?? '[]'); if (Array.isArray(raw)) seen = new Set(raw.filter((x) => GUIDE_TRIGGERS.includes(x))); } catch { seen = new Set(); }
  const save = () => { try { storage?.setItem(GUIDE_KEY, JSON.stringify([...seen])); } catch { /* 무시 */ } };
  return {
    has: (t) => seen.has(t),
    add(t) { seen.add(t); save(); },
    addAll() { for (const t of GUIDE_TRIGGERS) seen.add(t); save(); },
    clear() { seen = new Set(); try { storage?.removeItem(GUIDE_KEY); } catch { /* 무시 */ } },
    get done() { return GUIDE_TRIGGERS.every((t) => seen.has(t)); },
  };
}

/**
 * 경기 한 판 동안의 안내 진행기. 경기 시작 시점에 안내할 게 남았는지(active)로 고정한다 — 이 경기에서는 일반 힌트(tips)를 대신한다.
 * take(trigger) → 보여줄 페이지 배열(처음 한 번만) 또는 null. finish(trigger) 로 본 것으로 저장, skipAll() 은 건너뛰기(다시 안 나옴).
 */
export function createFirstGuide({ store, mode = 'simple', enabled = true }) {
  const active = !!enabled && !store.done;
  const taken = new Set();
  const pagesOf = (t) => (GUIDE_PAGES[mode] ?? GUIDE_PAGES.simple)[t];
  return {
    get active() { return active; },
    take(trigger) {
      if (!active || taken.has(trigger) || store.has(trigger) || !pagesOf(trigger)) return null;
      taken.add(trigger);
      return pagesOf(trigger);
    },
    finish(trigger) { store.add(trigger); },
    skipAll() { store.addAll(); },
  };
}

/** 홈 메뉴 설명을 본 적이 있는지 (새로 시작하면 다시 보여 준다). 한 번 열리면 닫아도 본 것으로 친다 */
export const MENU_GUIDE_KEY = 'tabgu-king-menuguide-v1';
export function createMenuGuideStore(storage = globalThis.localStorage) {
  let seen = false;
  try { seen = JSON.parse(storage?.getItem(MENU_GUIDE_KEY) ?? 'false') === true; } catch { seen = false; }
  return {
    get seen() { return seen; },
    mark() { seen = true; try { storage?.setItem(MENU_GUIDE_KEY, 'true'); } catch { /* 무시 */ } },
    clear() { seen = false; try { storage?.removeItem(MENU_GUIDE_KEY); } catch { /* 무시 */ } },
  };
}
