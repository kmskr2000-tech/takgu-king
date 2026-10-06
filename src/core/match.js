import { SIDES, STATES, WIN_SCORE, DEUCE_AT, GRADES } from './constants.js?v=1791277282';
import { flightOf } from './shot.js?v=1791277282';

export const otherSide = (s) => (s === SIDES.ME ? SIDES.OPP : SIDES.ME);

/**
 * 서브권: 2점마다 교대, 10:10(듀스) 이후는 매 점수 교대.
 * total = 지금까지 난 총 점수.
 */
export function serverFor(firstServer, total, deuce = false) {
  if (!deuce) return Math.floor(total / 2) % 2 === 0 ? firstServer : otherSide(firstServer);
  return (total - 2 * DEUCE_AT) % 2 === 0 ? firstServer : otherSide(firstServer);
}

/** 11점제 + 듀스(2점 차) 승자 판정. 없으면 null. */
export function gameWinner(me, opp) {
  if (me >= WIN_SCORE && me - opp >= 2) return SIDES.ME;
  if (opp >= WIN_SCORE && opp - me >= 2) return SIDES.OPP;
  return null;
}

/**
 * 경기 상태 기계: SERVE → RALLY ⇄ (POINT) → GAME_END. DOM/시간 무관.
 * 입력은 이미 만들어진 샷(createShot)과 판정(judgeTap) — 판정/AI는 호출 쪽 책임.
 */
export function createMatch({ firstServer = SIDES.ME } = {}) {
  const m = {
    state: STATES.SERVE,
    score: { me: 0, opp: 0 },
    firstServer,
    server: firstServer,
    rally: null, // { hitter, receiver, flight, shots }
    winner: null,
    lastPoint: null, // { winner, reason, rallyShots }
    history: [],
  };

  const total = () => m.score.me + m.score.opp;
  const inDeuce = () => m.score.me >= DEUCE_AT && m.score.opp >= DEUCE_AT;

  function award(side, reason) {
    m.score[side] += 1;
    const shots = m.rally?.shots ?? 0;
    m.lastPoint = { winner: side, reason, rallyShots: shots };
    m.history.push({ ...m.lastPoint, score: { ...m.score } });
    m.rally = null;
    const w = gameWinner(m.score.me, m.score.opp);
    if (w) {
      m.winner = w;
      m.state = STATES.GAME_END;
    } else {
      m.state = STATES.POINT;
    }
    return m.lastPoint;
  }

  function need(state, action) {
    if (m.state !== state) throw new Error(`${action}: ${state} 상태에서만 가능 (현재 ${m.state})`);
  }

  /** 서버가 서브. 폴트(네트/아웃)면 즉시 실점. */
  m.serve = (shot) => {
    need(STATES.SERVE, 'serve');
    if (shot.side !== m.server) throw new Error(`서브권은 ${m.server} 에게 있다`);
    const flight = flightOf(shot);
    m.rally = { hitter: m.server, receiver: otherSide(m.server), flight, shots: 1 };
    if (flight.kind !== 'in') return { point: award(otherSide(m.server), `serve-${flight.kind}`), flight };
    m.state = STATES.RALLY;
    return { flight };
  };

  /**
   * 받는 쪽 응답. judgement: judgeTap/judgeNoTap 결과, shot: 리턴 샷 (MISS 면 생략).
   * MISS → 친 쪽 득점. 리턴이 네트/아웃 → 받은 쪽 실점.
   */
  m.respond = (judgement, shot = null) => {
    need(STATES.RALLY, 'respond');
    const { hitter, receiver } = m.rally;
    if (judgement.grade === GRADES.MISS) return { point: award(hitter, 'miss') };
    if (!shot || shot.side !== receiver) throw new Error('리턴 샷이 받는 쪽 것이어야 한다');
    const flight = flightOf(shot);
    m.rally.shots += 1;
    if (flight.kind !== 'in') return { point: award(hitter, flight.kind), flight };
    m.rally = { hitter: receiver, receiver: hitter, flight, shots: m.rally.shots };
    return { flight };
  };

  /** POINT → 다음 서브(SERVE). */
  m.nextPoint = () => {
    need(STATES.POINT, 'nextPoint');
    m.server = serverFor(m.firstServer, total(), inDeuce());
    m.state = STATES.SERVE;
    return m.server;
  };

  m.isOver = () => m.state === STATES.GAME_END;
  return m;
}
