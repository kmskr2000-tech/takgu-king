// 출석 보상: 하루 한 번, 7일 주기 달력. 연속 출석이 끊기면 1일차부터 다시.
// 시즌 저장과 따로 둔다(새로 시작해도 출석 연속은 유지). DOM 무관 순수 로직 — 기록 객체 { last: 'YYYY-MM-DD', streak } 만 다룬다.
const KEY = 'tabgu-king-daily-v1';

/** 1~7일차 보상(스탯 포인트). 7일차는 큰 보상 */
export const DAILY_REWARDS = Object.freeze([1, 1, 2, 1, 1, 2, 3]);

const pad = (n) => String(n).padStart(2, '0');
/** 기기 현지 날짜 키 */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function prevKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export function loadDaily(storage) {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (raw && typeof raw.last === 'string' && Number.isFinite(raw.streak)) return { last: raw.last, streak: Math.max(0, Math.floor(raw.streak)) };
  } catch { /* 깨진 기록은 새로 시작 */ }
  return { last: null, streak: 0 };
}
export function saveDaily(storage, rec) {
  try { storage?.setItem(KEY, JSON.stringify(rec)); } catch { /* 저장 실패는 무시 (다음에 다시 받을 수 있음) */ }
}

/** 오늘 상태: claimable(받을 수 있나), day(오늘 받을/받은 칸 1~7), streak(받은 뒤 연속 일수) */
export function dailyStatus(rec, today = dayKey()) {
  if (rec.last === today) return { claimable: false, day: ((Math.max(1, rec.streak) - 1) % 7) + 1, streak: rec.streak, rewards: DAILY_REWARDS };
  const streak = rec.last && rec.last === prevKey(today) ? rec.streak + 1 : 1;
  return { claimable: true, day: ((streak - 1) % 7) + 1, streak, rewards: DAILY_REWARDS };
}

/** 받기: 새 기록과 보상량을 돌려준다 (이미 받았으면 null). 포인트 지급은 호출 쪽(app)이 한다 */
export function claimDaily(rec, today = dayKey()) {
  const st = dailyStatus(rec, today);
  if (!st.claimable) return null;
  return { rec: { last: today, streak: st.streak }, amount: DAILY_REWARDS[st.day - 1], day: st.day };
}
