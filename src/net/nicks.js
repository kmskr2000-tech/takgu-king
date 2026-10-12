// 멀티플레이 신원·닉네임 선점·방 비밀번호: 전송 계층과 무관한 순수 로직 (FirebaseRoom / 메모리 방이 함께 쓴다).
//
// 닉네임 선점제: 먼저 등록한 사람이 임자. 등록 레코드 { uid, nick, claimed, seen } 를 닉네임 키 아래에 두고,
// 같은 uid 만 다시 쓸 수 있다. 오래(NICK_TTL_MS) 안 쓴 닉네임은 다른 사람이 가져갈 수 있다. uid 는 Firebase 익명 로그인(없으면 기기 ID).
export const NICK_MAX = 12;
export const NICK_TTL_MS = 90 * 24 * 3600 * 1000; // 90일 안 쓴 닉네임은 반납된 것으로 본다
export const PW_MIN = 4;
export const PW_MAX = 12;

export const cleanNick = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, NICK_MAX);
/** 비교용 정규형: 대소문자·공백 차이로 '같은 닉네임'을 우회하지 못하게 */
export const normalizeNick = (t) => cleanNick(t).normalize('NFC').toLowerCase().replace(/\s+/g, '');
/** RTDB 키로 안전한 닉네임 키 (. $ # [ ] / 금지 → 코드포인트를 36진수로) */
export const nickKey = (t) => Array.from(normalizeNick(t), (c) => c.codePointAt(0).toString(36)).join('-');

/**
 * 선점 판정(순수). cur: 지금 등록된 레코드(없으면 null). 반환 { ok, value } — ok 면 value 를 기록한다.
 * 비어 있음 / 내 것 / 만료됨 → 가능. 그 밖엔 taken.
 */
export function decideClaim(cur, { uid, nick, now }) {
  const mine = { uid, nick: cleanNick(nick), claimed: now, seen: now };
  if (!cur || typeof cur !== 'object') return { ok: true, value: mine };
  if (cur.uid === uid) return { ok: true, value: { ...cur, nick: mine.nick, seen: now } };
  if (now - (Number(cur.seen) || Number(cur.claimed) || 0) > NICK_TTL_MS) return { ok: true, value: mine };
  return { ok: false, value: cur };
}

/** 방 비밀번호 검사: 비어 있으면 '없음', 아니면 4~12자 */
export function checkPassword(raw) {
  const pw = String(raw ?? '').trim();
  if (!pw) return { ok: true, password: '' };
  if (pw.length < PW_MIN || pw.length > PW_MAX) return { ok: false, password: '', error: `비밀번호는 ${PW_MIN}~${PW_MAX}자로 정해 주세요.` };
  return { ok: true, password: pw };
}

/**
 * 비밀번호 증명: 비밀번호 자체는 DB 에 올리지 않는다. 손님은 (방 코드 + 손님 ID + 비밀번호)의 SHA-256 을 올리고,
 * 방장이 자기 기억 속 비밀번호로 같은 값을 계산해 비교한다. 손님 ID 가 매번 달라서 엿본 증명을 다른 접속에 재사용할 수 없다.
 */
export async function passwordProof(code, guestId, password) {
  const data = new TextEncoder().encode(`tabgu|${code}|${guestId}|${password}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const DEVICE_KEY = 'tabgu-king-devid-v1';
/**
 * 신원 가져오기: 익명 로그인(signIn → uid 문자열) 성공 시 그 uid, 실패/미지원이면 기기에 저장된 임의 ID.
 * 반환 { uid, anon } — anon 은 Firebase 익명 로그인 여부.
 */
export async function resolveIdentity({ signIn = null, storage = globalThis.localStorage, timeoutMs = 4000 } = {}) {
  if (signIn) {
    try {
      const uid = await Promise.race([signIn(), new Promise((_, rej) => setTimeout(() => rej(new Error('auth-timeout')), timeoutMs))]);
      if (uid) return { uid: String(uid), anon: true };
    } catch { /* 익명 로그인 불가(콘솔에서 미사용·오프라인) → 기기 ID */ }
  }
  let id = '';
  try { id = storage?.getItem(DEVICE_KEY) || ''; } catch { id = ''; }
  if (!id) {
    const buf = new Uint32Array(4); globalThis.crypto.getRandomValues(buf);
    id = `dev-${Array.from(buf, (x) => x.toString(36)).join('')}`;
    try { storage?.setItem(DEVICE_KEY, id); } catch { /* 무시 */ }
  }
  return { uid: id, anon: false };
}

/** 로비 정렬 보조: 빠른 대전 방끼리 누가 '먼저'인지 (만든 시각 → 코드). 양쪽이 같은 두 값을 보므로 시계가 틀려도 결과가 같다 */
export const quickBefore = (a, b) => (a.created - b.created) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
