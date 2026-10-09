import { SIDES, STATES } from './constants.js?v=1791523471';
import { createMatch, otherSide } from './match.js?v=1791523471';
import { aiServe, aiRespond, aiRating } from './ai.js?v=1791523471';

const MAX_SHOTS = 200; // 무한 랠리 방지

/** 한 점 진행 (둘 다 AI). 반환: 득점 정보 */
function playPoint(m, params, rng) {
  const server = m.server;
  let res = m.serve(aiServe(params[server], rng, server));
  let guard = 0;
  while (m.state === STATES.RALLY && guard++ < MAX_SHOTS) {
    const receiver = otherSide(m.rally.hitter);
    const foeX = m.rally.flight.land ? 100 - m.rally.flight.land.x : 50;
    const { judgement, shot } = aiRespond(params[receiver], rng, receiver, m.rally.flight, foeX, 'even', { read: false }); // AI 끼리는 상성을 읽지 않는다 (리그 곡선은 플레이어 상성과 무관하게 유지)
    res = m.respond(judgement, shot);
  }
  if (m.state === STATES.RALLY) throw new Error('랠리가 끝나지 않음');
  return res.point;
}

/**
 * AI 대 AI 풀 시뮬레이션 (코어 물리·판정 전부 사용).
 * params: { me: aiParams, opp: aiParams }
 */
export function simulateMatch(params, rng, { firstServer = SIDES.ME } = {}) {
  const m = createMatch({ firstServer });
  let points = 0;
  while (!m.isOver()) {
    playPoint(m, params, rng);
    points++;
    if (!m.isOver()) m.nextPoint();
    if (points > 400) throw new Error('경기가 끝나지 않음');
  }
  return { winner: m.winner, score: { ...m.score }, history: m.history };
}

/** 확률 기반 빠른 시뮬레이션 (시즌의 AI 끼리 경기용). 반환: 승자 'me'|'opp' (a=me, b=opp) */
export function quickWinProb(a, b) {
  const d = aiRating(a) - aiRating(b);
  return 1 / (1 + Math.exp(-12 * d));
}
export const simulateQuick = (a, b, rng) => (rng.next() < quickWinProb(a, b) ? SIDES.ME : SIDES.OPP);
