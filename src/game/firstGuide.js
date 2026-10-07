// 첫 경기 안내: 처음 하는 본 경기(튜토리얼 제외)에서 중요한 순간마다 경기를 멈추고 조작법을 단계별로 설명한다.
// DOM·시간 무관, 순수 로직. 트리거: 'serve'(내 서브 차례) / 'incoming'(첫 공이 튕겨 띠가 나타난 직후). 각 트리거는 평생 한 번.
export const GUIDE_KEY = 'tabgu-king-firstguide-v1';
export const GUIDE_TRIGGERS = Object.freeze(['serve', 'incoming']);

/** 조작 방식별 안내 페이지. 한 트리거에 여러 페이지면 같은 멈춤 안에서 차례로 넘긴다 */
export const GUIDE_PAGES = Object.freeze({
  simple: {
    serve: [
      { id: 'serve', title: '서브하기', text: '화면 맨 아래 [일반][탑스핀][커트] 버튼 중 하나를 누르면 서브해요.\n버튼을 누르는 순간이 곧 스윙이에요!' },
      { id: 'course', title: '코스 정하기', text: '코트의 왼쪽·가운데·오른쪽을 탭하면 공이 갈 코스가 바뀌어요.\n샷을 치기 전에 미리 정해 두세요.' },
    ],
    incoming: [
      { id: 'bands', title: '띠에 맞춰 누르기', text: '공이 튕기면 이렇게 띠가 나타나요.\n공이 띠 안에 있을 때 버튼을 누르세요!\n빨강 = 탑스핀(이르게) · 노랑 = 일반 · 파랑 = 커트(늦게)' },
      { id: 'perfect', title: 'PERFECT 노리기', text: '띠 한가운데의 밝은 줄에 맞추면 PERFECT!\n더 강하고 정확한 샷이 나가고 진동도 크게 와요.' },
      { id: 'pick', title: '공을 보고 고르기', text: '상대 공 종류가 화면에 떠요. 상성: 탑스핀 > 커트 > 일반 > 탑스핀.\n이기는 버튼은 반짝여요.\n그리고 상대가 서 있는 자리의 반대쪽 코스로 보내면 받기 어려워요!' },
    ],
  },
  advanced: {
    serve: [
      { id: 'serve', title: '서브하기', text: '화면을 탭하면 서브해요.\n탭하는 위치(왼쪽·가운데·오른쪽)가 공이 갈 코스예요.' },
    ],
    incoming: [
      { id: 'bands', title: '띠에 맞춰 탭하기', text: '공이 튕기면 이렇게 노란 띠가 나타나요.\n공이 띠 안에 있을 때 화면을 탭하세요!' },
      { id: 'perfect', title: 'PERFECT 노리기', text: '띠 한가운데 붉은 줄에 맞추면 PERFECT!\n더 강하고 정확한 샷이 나가고 진동도 크게 와요.' },
      { id: 'swipe', title: '쓸어서 스핀·파워', text: '탭하자마자 위로 쓸면 탑스핀, 아래로 쓸면 커트, 길게 쓸수록 강한 샷이에요.\n상대가 서 있는 자리의 반대쪽을 탭하면 받기 어려워요!' },
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
