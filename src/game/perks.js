// 리그 우승 특전: 스탯 포인트 대신 트로피·칭호·스킨 (스탯/밸런스 불변, 겉모습·수집 요소).
//  - CHAMPION_PERKS 한 곳이 정본 — 시즌 목표 문구·결과 화면·진열장이 모두 여기서 파생한다.
//  - 트로피는 리그별 우승 횟수(2회차·세계대회 계속에서 다시 우승하면 +1). 칭호·스킨은 해당 리그를 한 번이라도 우승하면 소유.
//  - 스킨은 내 선수 팔레트만 바꾼다(스프라이트 불변). 튜토리얼·멀티플레이는 기본 스킨.
import { LEAGUES } from '../core/index.js?v=1791532253';

export const DEFAULT_SKIN = 'default';
export const CHAMPION_PERKS = Object.freeze({
  amateur: { title: '동네 탁구왕', skin: '클럽 그린', palette: { c: '#3fb86b', d: '#2a8a4e', p: '#1f3b2c' } },
  third: { title: '3부 정복자', skin: '틸 스피드', palette: { c: '#2ec4b6', d: '#1f8f85', p: '#173c42' } },
  second: { title: '2부 지배자', skin: '선셋 오렌지', palette: { c: '#ff8a3d', d: '#c05a1a', p: '#4a2a18' } },
  first: { title: '1부 챔피언', skin: '로열 바이올렛', palette: { c: '#8a5ad6', d: '#5e3aa0', p: '#2e2150' } },
  world: { title: '세계 정상', skin: '실버 레전드', palette: { c: '#e8eef5', d: '#aab6c4', p: '#3a4558' } },
});

/** 지금 소유한 칭호·스킨 id (= 우승한 리그), 리그 순서대로 */
export const wonLeagues = (state) => LEAGUES.filter((lg) => (state.trophies?.[lg] ?? 0) > 0);

/** 저장 보강. 옛 저장(trophies 없음)은 이미 이긴 리그를 소급 지급한다: 현재 리그 아래 전부 + 해금 장비로 알 수 있는 리그 + 엔딩 달성 시 세계대회 */
export function ensurePerks(state, { retro = false } = {}) {
  const ok = state.trophies && typeof state.trophies === 'object' && !Array.isArray(state.trophies);
  if (!ok) {
    state.trophies = {};
    if (retro) {
      const idx = LEAGUES.indexOf(state.league);
      const grips = state.unlocked?.grips ?? []; const rackets = state.unlocked?.rackets ?? [];
      LEAGUES.forEach((lg, i) => {
        const items = [...(CHAMPION_UNLOCKS[lg]?.grips ?? []).map((g) => grips.includes(g)), ...(CHAMPION_UNLOCKS[lg]?.rackets ?? []).map((r) => rackets.includes(r))];
        if (i < idx || (items.length > 0 && items.every(Boolean)) || (lg === 'world' && state.cleared)) state.trophies[lg] = 1;
      });
    }
  }
  const won = wonLeagues(state);
  if (state.title != null && !won.includes(state.title)) state.title = null;
  if (state.title === undefined) state.title = won.length ? won[won.length - 1] : null;
  if (state.skin == null || (state.skin !== DEFAULT_SKIN && !won.includes(state.skin))) state.skin = DEFAULT_SKIN;
  return state;
}
// season.js 의 UNLOCKS 와 순환 import 를 피하려고 해금 표를 주입받는다 (season.js 가 등록)
let CHAMPION_UNLOCKS = {};
export const registerUnlocks = (u) => { CHAMPION_UNLOCKS = u; };

/** 리그 우승 시 지급. 반환: 요약에 붙일 { league, title, skin, count, first } */
export function grantPerks(state, league) {
  ensurePerks(state);
  const count = (state.trophies[league] = (state.trophies[league] ?? 0) + 1);
  const first = count === 1;
  if (first) state.title = league; // 새 리그 첫 우승이면 칭호를 바로 달아 준다 (스킨은 직접 고른다)
  const p = CHAMPION_PERKS[league];
  return { league, title: p.title, skin: p.skin, count, first };
}

export function selectTitle(state, league) {
  if (league !== null && !wonLeagues(state).includes(league)) throw new Error(`못 얻은 칭호: ${league}`);
  state.title = league; return state;
}
export function selectSkin(state, id) {
  if (id !== DEFAULT_SKIN && !wonLeagues(state).includes(id)) throw new Error(`못 얻은 스킨: ${id}`);
  state.skin = id; return state;
}
export const titleName = (state) => (state.title ? CHAMPION_PERKS[state.title]?.title ?? null : null);
