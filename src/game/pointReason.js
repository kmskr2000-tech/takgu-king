// 득점/실점 원인 문구. point 이벤트(winner, reason) + 직전 missed 이벤트(타이밍 실수 종류) + 내 마지막 샷 종류로 만든다.
// reason: 'miss'(받는 쪽이 못 쳤다) | 'net' | 'out'(리턴 샷의 실수) | 'serve-net' | 'serve-out'(서브 폴트)
// 실점 원인은 언제나 "점수를 잃은 쪽의 실수"다 (winner 의 반대편).
import { shotTypeOf } from './controls.js?v=1791528693';

const other = (s) => (s === 'me' ? 'opp' : 'me');

/**
 * @param {{winner:'me'|'opp', reason:string, myShotType?:string|null}} point
 * @param {{reason?:'early'|'late', noTap?:boolean}|null} missInfo  이번 점수 직전의 내 타이밍 실수(없으면 null)
 * @returns {{tone:'win'|'lose', title:string, detail:string, tip:string}}
 */
export function describePoint(point, missInfo = null) {
  const me = point.winner === 'me';
  const loser = other(point.winner);
  const tone = me ? 'win' : 'lose';
  const title = me ? '득점!' : '실점…';
  const typ = point.myShotType ? `내 ${shotTypeOf(point.myShotType).label} 샷` : '내 공';
  const r = point.reason;
  const out = (detail, tip = '') => ({ tone, title, detail, tip });
  if (r === 'miss') {
    if (loser === 'opp') return out('상대가 공을 받지 못했어요');
    if (missInfo?.noTap) return out('타이밍 띠가 지나갈 때까지 탭하지 못했어요', '공이 노란 띠에 들어오면 바로 탭!');
    if (missInfo?.reason === 'early') return out('너무 일찍 탭했어요', '공이 노란 띠 안에 들어올 때까지 기다려요');
    if (missInfo?.reason === 'late') return out('너무 늦게 탭했어요 (띠가 지나갔어요)', '조금 더 빨리 탭해요');
    return out('공을 받아치지 못했어요');
  }
  if (r === 'net') {
    if (loser === 'opp') return out('상대 공이 네트에 걸렸어요');
    return out(`${typ}이 네트에 걸렸어요`, point.myShotType === 'topspin' ? '탑스핀은 위험해요 — 일반이나 커트가 더 안정적' : '타이밍을 더 정확히(PERFECT) 맞춰요');
  }
  if (r === 'out') {
    if (loser === 'opp') return out('상대 공이 코트 밖으로 나갔어요');
    return out(`${typ}이 코트 밖으로 나갔어요`, '너무 세게 쳤어요 — 파워를 줄이거나 커트로');
  }
  if (r === 'serve-net' || r === 'serve-out') {
    const how = r === 'serve-net' ? '네트에 걸렸어요' : '코트 밖으로 나갔어요';
    return loser === 'me' ? out(`내 서브 실수 — 공이 ${how}`, '서브도 힘을 빼고 안정적으로') : out(`상대 서브 실수 — 공이 ${how}`);
  }
  return out('');
}

/** 상대 공 종류 칩 문구: 'topspin' → '상대 공: 탑스핀' */
export const incomingLabel = (key) => (key ? `상대 공: ${shotTypeOf(key).label}` : '');
