import { DEFAULT_DIFFICULTY, difficultyOf, assistTargetX } from './difficulty.js?v=1791335595';
import { simpleAim, shotTypeOf, shotKeyOfSpin, matchupOf, MATCHUP_FX, SHOT_ORDER, RHYTHM_SHIFT } from './controls.js?v=1791335595';
import { courseOf, COURSE_X, COMMIT_WINDOW } from '../core/index.js?v=1791335595';
import { DISGUISE_S } from './controls.js?v=1791335595';
import {
  SIDES, STATES, GRADES, createMatch, createShot, flightOf, buildTiming, judgeTap, judgeNoTap,
  classifyGesture, gestureToAim, aiServe, aiRespond, aiStats, otherSide,
} from '../core/index.js?v=1791335595';

/** 난수 배율 래퍼: createShot 의 실수 난수(signed)만 k 배. k=1 이면 기존과 비트 동일 */
export const scaledRng = (rng, k) => (k === 1 ? rng : { next: rng.next, signed: () => rng.signed() * k });

const OPP_SERVE_DELAY = 1.0; // 상대 서브 전 대기(초)
const POINT_PAUSE = 1.2; // 득점 후 연출 대기(초)

/**
 * 경기 컨트롤러: 코어(물리/판정/AI/상태기계)를 실시간 입력에 연결한다. DOM·타이머 무관 — now(초)를 외부에서 받는다.
 * phase: 'awaitServe'(내 서브 탭 대기) | 'oppServeWait' | 'flight'(공 비행 중) | 'pause'(득점 연출) | 'over'
 * events: onEvent({type:'point'|'grade'|'serve'|'hit'|'end', ...})
 */
export function createMatchController({
  stats, oppParams, rng, firstServer = SIDES.ME, courtWidth = 300, onEvent = () => {}, difficulty = DEFAULT_DIFFICULTY,
  controlMode = 'advanced', // 'simple': 샷 버튼을 누르는 순간이 스윙(c.swing) · 코트 탭은 코스만 / 'advanced': 탭 + 쓸기(확정 창 COMMIT_WINDOW)
  useMatchup = true, // 상성(가위바위보) 적용. 튜토리얼은 끈다
}) {
  const diff = difficultyOf(difficulty);
  // 간단 조작: 고른 샷 종류가 내 타이밍 존 폭을 바꾼다 (탑스핀 좁음 / 일반 보통 / 커트 넓음). 고급 조작은 쓸기로 정해지므로 1
  // 상성: 상대가 친 공 종류(스핀) 대비, 내가 "누른" 샷 종류 → 존 폭·오차 배율 (간단 조작만).
  // 샷 종류는 스윙하는 순간(버튼)에 정해지므로 화면의 타이밍 존은 중립 폭(일반 기준)으로만 보이고, 실제 판정 폭은 누른 종류로 그 순간 계산한다
  const matchupFor = (type) => {
    if (!useMatchup || controlMode !== 'simple' || !c.flight || c.flight.kind !== 'in') return 'even';
    return matchupOf(type, shotKeyOfSpin(c.flight.spin));
  };
  // 리듬 재설계 v2: 밴드는 "내가 누른 구질의 리듬"(위치·폭)만 바꾼다. 상성은 밴드 폭을 바꾸지 않는다(상성 효과는 실수 배율·상대 오차).
  const simple = controlMode === 'simple';
  // 상성 실수 배율 (등급별). 상성을 쓰지 않으면(튜토리얼·고급 조작) 기존과 동일한 1
  const noiseFor = (mu, grade) => (useMatchup ? MATCHUP_FX[mu].noise[grade] ?? 1 : 1);
  const leniencyFor = (type) => diff.leniency * (simple ? shotTypeOf(type).leniency : 1);
  const shiftFor = (type) => (simple ? RHYTHM_SHIFT[type] ?? 0 : 0);
  const timingFor = (flight, lenient, shift = 0) => buildTiming(flight, stats.focus, { leniency: lenient, shift, bad: true });
  const bandFor = (flight, type) => timingFor(flight, leniencyFor(type), shiftFor(type));
  // 노탭 만료: 어떤 종류를 눌러도 받아줄 수 있는 가장 늦은 밴드가 끝난 뒤
  const maxEnd = (flight) => Math.max(...SHOT_ORDER.map((k) => bandFor(flight, k).end));
  const m = createMatch({ firstServer });
  const c = {
    match: m, phase: null, flight: null, t0: 0, timing: null,
    pendingDown: null, aiAt: null, aiPlan: null, resumeAt: 0, lastGrade: null, lastGradeMe: null, streak: 0, streakKey: null, bands: null,
  };
  c.matchup = (type) => matchupFor(type); // 누른 종류 기준 상성 (테스트·UI)
  c.lane = 'center'; // 간단 조작: 코스 마커 (코트 탭으로 정함, 버튼 스윙이 이 코스로 나간다)
  // 구질 위장(상위 리그): 타구 직후 잠깐 공 색·종류 칩을 중립으로 보여 읽기 단서를 늦춘다. 판정·상성은 진짜 스핀 기준
  c.disguiseS = useMatchup && simple ? DISGUISE_S[oppParams?.league] ?? 0 : 0;
  c.spinHidden = (now) => c.disguiseS > 0 && !!c.flight && c.flight.dir > 0 && now - c.t0 < c.disguiseS;
  c.stats = stats;
  c.controlMode = controlMode;
  c.difficulty = difficulty;

  const emit = (e) => onEvent(e);

  function launch(flight, now) {
    c.flight = flight;
    c.t0 = now;
    c.timing = null;
    c.aiAt = null;
  }

  function afterShot(res, now, shooter) {
    if (shooter !== SIDES.ME) c.lastMatchup = 'even';
    // res: serve/respond 결과. 득점이면 pause, 아니면 받는 쪽 대기 설정
    if (res.flight) launch(res.flight, now);
    // 방향 전환 효과: 상대는 자기가 마지막으로 친 자리에 서 있다 (내 서브 직후엔 중앙). aiRespond 가 내 공과의 거리로 탭 오차를 키운다
    if (shooter === SIDES.OPP && res.flight) c.oppX = res.flight.pos(0).x; else if (m.rally?.shots === 1) c.oppX = 50; // 내 서브: 상대는 중앙에서 받는다
    if (res.point) {
      c.phase = m.isOver() ? 'over' : 'pause';
      c.resumeAt = now + (res.flight ? res.flight.tLand : 0) + POINT_PAUSE;
      // winner = 이 점수를 낸 쪽(res.point.winner). 경기 승자는 matchWinner 로 분리 (예전엔 winner 를 경기 승자(경기 중 null)로 덮어써서 득점이 전부 '실점'으로 처리됐다)
      emit({ type: 'point', ...res.point, myShotType: c.lastMyShot ?? null, score: { ...m.score }, over: m.isOver(), matchWinner: m.winner });
      if (m.isOver()) emit({ type: 'end', winner: m.winner, score: { ...m.score } });
      return;
    }
    c.phase = 'flight';
    const receiver = otherSide(shooter);
    if (receiver === SIDES.ME) {
      c.timing = timingFor(res.flight, diff.leniency); // 중립(일반) 밴드 — 고급 조작 판정·기본 표시
      c.bands = simple ? Object.fromEntries(SHOT_ORDER.map((k) => [k, bandFor(res.flight, k)])) : null; // 간단 조작: 구질별 리듬 밴드 3개(텔레그래핑 표시용)
      c.timingEnd = simple ? maxEnd(res.flight) : c.timing.end;
      c.pendingDown = null;
    } else {
      // AI 리턴을 지금 계산해 두고, 실제 탭 시각(미스면 창이 끝나는 시각)에 반영 → 공이 튀지 않는다
      const foeX = 100 - (res.flight.land?.x ?? 50);
      const key = useMatchup && simple ? `${c.lastMatchup}:${c.lastGradeMe ?? GRADES.GOOD}` : 'even';
      const plan = aiRespond(oppParams, rng, SIDES.OPP, res.flight, foeX, key, { streak: c.streak, oppX: c.oppX });
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

  /** 간단 조작: 코트를 탭하면 코스 마커만 옮긴다 (스윙 아님). 코스는 상대 위치를 보고 미리 계획하는 값이라 베팅이 아니다 */
  c.setLane = (x) => {
    const lane = courseOf(x / courtWidth);
    c.lane = lane;
    emit({ type: 'lane', lane });
    return lane;
  };

  /** 한 번의 판정 + 샷 발사 (간단 조작 swing 과 고급 조작이 공유하는 MISS 처리) */
  function missNow(now, judge, x, y) {
    c.pendingDown = { now, x, y, judge, last: { x, y } };
    emit({ type: 'missed', reason: judge.offset < 0 ? 'early' : 'late' });
    respondMe(now, null);
  }

  /**
   * 간단 조작의 스윙: 샷 버튼을 누르는 순간 = 스윙 (1단계). 샷 종류는 이 순간 상대 공을 보고 정한 것이다.
   * 서브 대기 중이면 서브, 날아오는 공이 있으면 판정 후 리턴. 타이밍 판정 폭은 (난이도 × 누른 종류 × 상성) 으로 이 순간 계산한다.
   */
  c.swing = (now, type) => {
    if (controlMode !== 'simple') return false;
    const key = SHOT_ORDER.includes(type) ? type : 'normal';
    if (c.phase === 'awaitServe') {
      const aim = simpleAim(COURSE_X[c.lane], key);
      c.lastMyShot = key; c.lastMatchup = 'even'; c.lastGradeMe = null;
      afterShot(m.serve(createShot({ from: { x: 50, side: SIDES.ME }, aim, stats, rng })), now, SIDES.ME);
      emit({ type: 'serve', side: SIDES.ME, shotType: key });
      return true;
    }
    if (c.phase !== 'flight' || !c.timing || c.pendingDown) return false;
    const judge = judgeTap(now - c.t0, c.bands?.[key] ?? bandFor(c.flight, key));
    const pos = c.flight.postPos(now - c.t0);
    const mu = matchupFor(key); // 판정 시점의 상성 (샷을 만들고 나면 flight 가 바뀐다)
    c.lastGrade = judge.grade;
    emit({ type: 'grade', grade: judge.grade, offset: judge.offset, x: pos.x, matchup: mu, shotType: key }); // x: 탭 순간 공의 위치(선수 스텝·스윙 연출용)
    if (judge.grade === GRADES.MISS) { missNow(now, judge, 0, 0); return true; } // 구간 밖(너무 이르거나 늦음)은 즉시 실점
    const aim = simpleAim(COURSE_X[c.lane], key);
    if (diff.assistCourse) aim.targetX = assistTargetX(c.flight.pos(0).x, aim.targetX);
    c.pendingDown = { now, x: 0, y: 0, judge, last: { x: 0, y: 0 } };
    const shot = createShot({
      from: { x: pos.x, side: SIDES.ME }, aim, stats, rng: scaledRng(rng, noiseFor(mu, judge.grade)), grade: judge.grade, offset: judge.offset * shotTypeOf(key).error, hitY: pos.y, // 공격은 오차↑, 수비는 오차↓ / 상성은 실수 난수 배율(불리 ↑, 유리 ↓)
    });
    respondMe(now, shot, { course: c.lane, spin: aim.spin, power: aim.power, shotType: key, matchup: mu });
    return true;
  };

  c.pointerDown = (now, x, y) => {
    if (controlMode === 'simple') { c.setLane(x); return; } // 간단 조작: 코트 탭 = 코스 지정만
    if (c.phase === 'awaitServe') {
      c.pendingDown = { now, x, y, judge: null, last: { x, y } };
      return;
    }
    if (c.phase === 'flight' && c.timing && !c.pendingDown) {
      const judge = judgeTap(now - c.t0, c.timing);
      const pos = c.flight.postPos(now - c.t0);
      c.lastGrade = judge.grade;
      emit({ type: 'grade', grade: judge.grade, offset: judge.offset, x: pos.x, matchup: 'even' });
      if (judge.grade === GRADES.MISS) { missNow(now, judge, x, y); return; } // 구간 밖 탭은 즉시 실점
      c.pendingDown = { now, x, y, judge, last: { x, y } };
    }
  };

  /** 쓸기(고급 조작) 추적: 확정 순간의 손가락 위치를 쓰기 위해 마지막 위치를 기록 */
  c.pointerMove = (now, x, y) => {
    if (c.pendingDown) c.pendingDown.last = { x, y };
  };

  function respondMe(now, shot, gesture = null) {
    const noTap = !c.pendingDown;
    const judge = c.pendingDown?.judge ?? judgeNoTap(c.timing);
    c.lastMatchup = gesture?.matchup ?? 'even'; // 내 샷의 상성 → 상대 반응(AI 탭 오차)에 반영
    c.lastGradeMe = judge.grade; // 내 타격 등급 → 상대 압박(PERFECT 일수록 AI 가 흔들린다)
    if (shot && gesture?.shotType) { // 패턴 읽기: 같은 종류를 연속으로 쓴 횟수 (AI 가 편중을 읽는다)
      c.streak = gesture.shotType === c.streakKey ? c.streak + 1 : 1; c.streakKey = gesture.shotType;
    }
    c.pendingDown = null;
    c.timing = null;
    c.lastMyShot = shot ? gesture?.shotType ?? null : c.lastMyShot ?? null;
    if (noTap) emit({ type: 'missed', reason: 'late', noTap: true }); // 노탭: 존이 끝날 때까지 안 눌렀다
    const res = m.respond(judge, shot);
    afterShot(res, now, SIDES.ME);
    // 내 리턴 결과(튜토리얼·통계용): 판정 + 입력한 코스/스핀/파워 + 공이 코트에 들어갔는지('in') 네트/아웃인지
    if (gesture && shot) emit({ type: 'return', grade: judge.grade, course: gesture.course, spin: gesture.spin, power: gesture.power, shotType: gesture.shotType, matchup: gesture.matchup, kind: res.flight?.kind ?? 'in' });
    return res;
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
      respondMe(now, shot, g);
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
    // 고급 조작: 탭 후 COMMIT_WINDOW 안에 샷을 확정한다(손을 안 떼도) → 뗄 때까지 공이 멈춰 보이지 않는다. up 이 유실돼도 막히지 않는다
    const pd = c.pendingDown;
    if (pd && (c.phase === 'flight' || c.phase === 'awaitServe') && now - pd.now >= COMMIT_WINDOW) {
      c.pointerUp(now, pd.last?.x ?? pd.x, pd.last?.y ?? pd.y);
    }
    switch (c.phase) {
      case 'oppServeWait':
        if (now >= c.resumeAt) doOppServe(now);
        break;
      case 'flight':
        if (c.timing && !c.pendingDown && now - c.t0 > (c.timingEnd ?? c.timing.end)) {
          respondMe(now, null); // 노탭 MISS
        } else if (c.aiAt != null && now >= c.aiAt) {
          const { judgement, shot } = c.aiPlan;
          emit({ type: 'aiReturn', kind: !shot ? 'miss' : shot.power >= 0.6 ? 'counter' : shot.power <= 0.35 ? 'weak' : 'normal', power: shot?.power ?? 0 }); // 상대 반응(연출·안내용)
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
