import { DEFAULT_DIFFICULTY, difficultyOf, assistTargetX } from './difficulty.js?v=1791278878';
import {
  SIDES, STATES, GRADES, createMatch, createShot, flightOf, buildTiming, judgeTap, judgeNoTap,
  classifyGesture, gestureToAim, aiServe, aiRespond, aiStats, otherSide,
} from '../core/index.js?v=1791278878';

const OPP_SERVE_DELAY = 1.0; // 상대 서브 전 대기(초)
const POINT_PAUSE = 1.2; // 득점 후 연출 대기(초)
const HOLD_MAX = 0.6; // 손가락을 이만큼 이상 누르고 있으면 탭으로 자동 확정(up 유실 대비)

/**
 * 경기 컨트롤러: 코어(물리/판정/AI/상태기계)를 실시간 입력에 연결한다. DOM·타이머 무관 — now(초)를 외부에서 받는다.
 * phase: 'awaitServe'(내 서브 탭 대기) | 'oppServeWait' | 'flight'(공 비행 중) | 'pause'(득점 연출) | 'over'
 * events: onEvent({type:'point'|'grade'|'serve'|'hit'|'end', ...})
 */
export function createMatchController({
  stats, oppParams, rng, firstServer = SIDES.ME, courtWidth = 300, onEvent = () => {}, difficulty = DEFAULT_DIFFICULTY,
}) {
  const diff = difficultyOf(difficulty);
  const m = createMatch({ firstServer });
  const c = {
    match: m, phase: null, flight: null, t0: 0, timing: null,
    pendingDown: null, aiAt: null, aiPlan: null, resumeAt: 0, lastGrade: null,
  };
  c.stats = stats;
  c.difficulty = difficulty;

  const emit = (e) => onEvent(e);

  function launch(flight, now) {
    c.flight = flight;
    c.t0 = now;
    c.timing = null;
    c.aiAt = null;
  }

  function afterShot(res, now, shooter) {
    // res: serve/respond 결과. 득점이면 pause, 아니면 받는 쪽 대기 설정
    if (res.flight) launch(res.flight, now);
    if (res.point) {
      c.phase = m.isOver() ? 'over' : 'pause';
      c.resumeAt = now + (res.flight ? res.flight.tLand : 0) + POINT_PAUSE;
      emit({ type: 'point', ...res.point, score: { ...m.score }, over: m.isOver(), winner: m.winner });
      if (m.isOver()) emit({ type: 'end', winner: m.winner, score: { ...m.score } });
      return;
    }
    c.phase = 'flight';
    const receiver = otherSide(shooter);
    if (receiver === SIDES.ME) {
      c.timing = buildTiming(res.flight, stats.focus, { leniency: diff.leniency });
      c.pendingDown = null;
    } else {
      // AI 리턴을 지금 계산해 두고, 실제 탭 시각(미스면 창이 끝나는 시각)에 반영 → 공이 튀지 않는다
      const foeX = 100 - (res.flight.land?.x ?? 50);
      const plan = aiRespond(oppParams, rng, SIDES.OPP, res.flight, foeX);
      c.aiPlan = plan;
      c.aiAt = now + (plan.judgement.grade === GRADES.MISS ? plan.timing.end : plan.t);
    }
    emit({ type: 'hit', side: shooter, flight: res.flight });
  }

  function doOppServe(now) {
    const shot = aiServe(oppParams, rng, SIDES.OPP, 50);
    afterShot(m.serve(shot), now, SIDES.OPP);
    emit({ type: 'serve', side: SIDES.OPP });
  }

  c.start = (now) => {
    if (m.server === SIDES.ME) c.phase = 'awaitServe';
    else { c.phase = 'oppServeWait'; c.resumeAt = now + OPP_SERVE_DELAY; }
  };

  c.pointerDown = (now, x, y) => {
    if (c.phase === 'awaitServe') {
      c.pendingDown = { now, x, y, judge: null };
      return;
    }
    if (c.phase === 'flight' && c.timing && !c.pendingDown) {
      const judge = judgeTap(now - c.t0, c.timing);
      c.pendingDown = { now, x, y, judge };
      emit({ type: 'grade', grade: judge.grade, offset: judge.offset });
      c.lastGrade = judge.grade;
      // 구간 밖 탭은 즉시 실점
      if (judge.grade === GRADES.MISS) respondMe(now, null);
    }
  };

  function respondMe(now, shot) {
    const judge = c.pendingDown?.judge ?? judgeNoTap(c.timing);
    c.pendingDown = null;
    c.timing = null;
    const res = m.respond(judge, shot);
    afterShot(res, now, SIDES.ME);
  }

  c.pointerUp = (now, x, y) => {
    const d = c.pendingDown;
    if (!d) return;
    const g = classifyGesture({ down: { x: d.x, y: d.y, t: d.now }, up: { x, y }, courtWidth });
    const aim = gestureToAim(g);
    if (diff.assistCourse && c.phase === 'flight' && c.flight) aim.targetX = assistTargetX(c.flight.pos(0).x, aim.targetX); // 쉬움: 상대 위치 기준 자동 코스
    if (c.phase === 'awaitServe') {
      c.pendingDown = null;
      const shot = createShot({
        from: { x: 50, side: SIDES.ME }, aim, stats, rng,
      });
      afterShot(m.serve(shot), now, SIDES.ME);
      emit({ type: 'serve', side: SIDES.ME });
      return;
    }
    if (c.phase === 'flight' && c.timing && d.judge.grade !== GRADES.MISS) {
      const pos = c.flight.postPos(d.now - c.t0);
      const shot = createShot({
        from: { x: pos.x, side: SIDES.ME }, aim, stats, rng,
        grade: d.judge.grade, offset: d.judge.offset, hitY: pos.y,
      });
      respondMe(now, shot);
    }
  };

  /** 포인터 취소(OS 인터럽트 등): flight 는 down 지점 탭으로 확정, 서브 대기는 입력 폐기 */
  c.pointerCancel = (now) => {
    const d = c.pendingDown;
    if (!d) return;
    if (c.phase === 'flight') c.pointerUp(now, d.x, d.y);
    else c.pendingDown = null;
  };

  c.update = (now) => {
    if (c.phase === 'flight' && c.pendingDown && now - c.pendingDown.now > HOLD_MAX) {
      c.pointerCancel(now); // up 이 오지 않는 경우 랠리 정지 방지
    }
    switch (c.phase) {
      case 'oppServeWait':
        if (now >= c.resumeAt) doOppServe(now);
        break;
      case 'flight':
        if (c.timing && !c.pendingDown && now - c.t0 > c.timing.end) {
          respondMe(now, null); // 노탭 MISS
        } else if (c.aiAt != null && now >= c.aiAt) {
          const { judgement, shot } = c.aiPlan;
          const at = c.aiAt; // 예약 시각 기준으로 발사 (프레임 시각 아님)
          c.aiAt = null; c.aiPlan = null;
          afterShot(m.respond(judgement, shot), at, SIDES.OPP);
        }
        break;
      case 'pause':
        if (now >= c.resumeAt) {
          m.nextPoint();
          c.flight = null;
          c.start(now);
        }
        break;
      default:
    }
  };

  /** 렌더링용 공 상태: { x, y, z, visible } (코트 좌표) */
  c.ballAt = (now) => {
    if (!c.flight) return { visible: false };
    // 손가락이 닿아 있는 동안(드래그 중)엔 공이 타격 지점에 붙어 있다가, 뗄 때 그 지점에서 발사된다
    const held = c.phase === 'flight' && c.timing && c.pendingDown?.judge && c.pendingDown.judge.grade !== GRADES.MISS;
    const t = (held ? c.pendingDown.now : now) - c.t0;
    const f = c.flight;
    if (f.kind === 'net') {
      const p = f.pos(Math.min(t, f.tNet ?? f.tLand));
      return { visible: t < (f.tNet ?? 0) + 0.5, ...p };
    }
    if (t <= f.tLand) return { visible: true, ...f.pos(t) };
    if (f.kind === 'in') {
      const p = f.postPos(t);
      const hop = Math.max(0, 14 * Math.sin(Math.min(1, (t - f.tLand) / 0.5) * Math.PI)); // 바운드 후 작은 튕김
      return { visible: true, ...p, z: hop };
    }
    return { visible: t < f.tLand + 0.4, ...f.pos(f.tLand) };
  };

  return c;
}
