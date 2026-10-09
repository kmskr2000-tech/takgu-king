// 커리어 이벤트: 정규 시즌 구간마다 한 번, 확률형 선택지 vs 확정형 선택지. 확률은 화면에 숫자로 공개하고 그 숫자 그대로 굴린다.
//  - 효과는 스탯 포인트만 (경기·AI·판정 불변). 확정형 = 확률형 성공 보상의 절반(항상 받음), 확률형 실패 = 포인트 1 손실(0 아래로는 안 내려감).
//  - 어떤 이벤트가 나올지는 시즌·주차로 정해진다(난수 소모 없음). 성공 여부만 굴리며, 호출 쪽이 따로 만든 난수를 넘긴다 — 시즌·경기 난수 흐름과 분리.
//  - 선택은 state.events.history 에 기록된다(화면 하단 '커리어 모드는 선택이 기록됩니다').
export const EVENT_WEEKS = Object.freeze([4, 7]); // 이 주차가 되면(= 직전 경기 후) 이벤트 발생
export const FAIL_LOSS = 1;
const HISTORY_MAX = 30;

export const CAREER_EVENTS = Object.freeze([
  { id: 'rival-taunt', title: '라이벌의 도발', scene: '라이벌이 SNS에 도발 글을 올렸다…!', line: '이번 경기… 반드시 이기겠다고 선전포고했어.', risky: { label: '맞받아친다', p: 0.65, reward: 4 }, safe: { label: '무시하고 훈련한다' } },
  { id: 'sponsor', title: '스폰서 제안', scene: '동네 탁구용품점이 후원을 제안했다.', line: '계약 조건, 한번 세게 불러볼까?', risky: { label: '조건을 밀어붙인다', p: 0.6, reward: 6 }, safe: { label: '제안을 그대로 받는다' } },
  { id: 'night-practice', title: '야간 특훈', scene: '체육관 열쇠를 받았다. 밤새 칠 수 있다.', line: '무리하면 다치지만… 해볼 만하다.', risky: { label: '밤새 특훈한다', p: 0.65, reward: 4 }, safe: { label: '적당히 치고 쉰다' } },
  { id: 'club-visit', title: '동호회 초청', scene: '옆 동네 고수 동호회에서 연습 경기를 청했다.', line: '고수들과 붙으면 배울 게 많겠지.', risky: { label: '고수에게 도전한다', p: 0.7, reward: 2 }, safe: { label: '관전하며 배운다' } },
  { id: 'new-racket', title: '시험용 라켓', scene: '선배가 신형 라켓을 빌려주겠단다.', line: '손에 맞으면 대박인데…', risky: { label: '대회 직전에 써본다', p: 0.6, reward: 6 }, safe: { label: '연습 때만 써본다' } },
  { id: 'tv-interview', title: 'TV 인터뷰', scene: '지역 방송국이 인터뷰를 요청했다.', line: '긴장되지만 기회다.', risky: { label: '당당히 출연한다', p: 0.65, reward: 4 }, safe: { label: '짧게 답하고 끝낸다' } },
]);

/** 확정형 보상 = 확률형 성공 보상의 절반 (반올림 없이 정수만 쓰도록 이벤트 reward 는 짝수) */
export const safeReward = (ev) => ev.risky.reward / 2;

/** 저장 보강 (예전 저장에는 없다) */
export function ensureEvents(state) {
  const e = state.events;
  if (!e || typeof e !== 'object' || !Array.isArray(e.history)) state.events = { history: [] };
  return state.events;
}

const keyOf = (state, week = state.week) => `${state.season}:${state.cycle ?? 1}:${week}`;

/** 지금 처리할 이벤트 (없으면 null). 정규 시즌의 이벤트 주차에만 — 훈련·튜토리얼·멀티는 호출하지 않는다 */
export function pendingEvent(state) {
  if (state.phase !== 'regular' || !EVENT_WEEKS.includes(state.week)) return null;
  const ev = ensureEvents(state);
  const key = keyOf(state);
  if (ev.history.some((h) => h.key === key)) return null;
  const slot = EVENT_WEEKS.indexOf(state.week);
  const idx = (((state.season - 1) * EVENT_WEEKS.length + slot + (state.cycle ?? 1) - 1) % CAREER_EVENTS.length + CAREER_EVENTS.length) % CAREER_EVENTS.length;
  return { key, event: CAREER_EVENTS[idx] };
}

/** 선택 반영. choice: 'risky' | 'safe', rng: { next() }. 반환: { choice, success, delta, points } */
export function resolveEvent(state, choice, rng) {
  const pe = pendingEvent(state);
  if (!pe) throw new Error('처리할 이벤트가 없음');
  if (choice !== 'risky' && choice !== 'safe') throw new Error(`알 수 없는 선택: ${choice}`);
  const ev = pe.event;
  let success = true; let delta;
  if (choice === 'risky') { success = rng.next() < ev.risky.p; delta = success ? ev.risky.reward : (state.statPoints > 0 ? -Math.min(FAIL_LOSS, state.statPoints) : 0); }
  else delta = safeReward(ev);
  state.statPoints += delta;
  const log = ensureEvents(state).history;
  log.push({ key: pe.key, id: ev.id, choice, success, delta, season: state.season, week: state.week });
  if (log.length > HISTORY_MAX) log.splice(0, log.length - HISTORY_MAX);
  return { choice, success, delta, points: state.statPoints };
}
