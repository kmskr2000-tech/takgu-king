// 체험형 튜토리얼: 실제 경기 이벤트(serve/return/missed/point)를 받아 단계를 진행한다. DOM·시간 무관, 순수 로직.
// 이벤트: {type:'serve', side} / {type:'return', grade, course, spin, power, kind} / {type:'missed', reason} / {type:'point', winner}
export const TUTORIAL_KEY = 'tabgu-king-tutorial-v1';

const inCourt = (e) => e.type === 'return' && e.kind === 'in' && e.grade !== 'MISS';

/**
 * goals: 단계를 끝내려면 모두 채워야 하는 목표들. hint: 화면 안내 {lane, arrow, power, button}. done: 단계가 끝났을 때의 설명(왜 그런지).
 * 간단/고급 조작에 따라 단계와 문구가 다르다 (간단: 탭 + 샷 버튼, 고급: 탭 + 쓸기).
 */
const STEP_SERVE = {
  id: 'serve', title: '서브하기', text: '화면을 탭하면 서브해요. 한 번 탭해 보세요!',
  goals: [{ key: 'serve', need: 1, label: '서브', accept: (e) => e.type === 'serve' && e.side === 'me' }], hint: {},
  done: '서브는 탭 한 번이면 돼요.',
};
const SIMPLE_SERVE = {
  ...STEP_SERVE, text: '아래 "일반" 버튼을 누르면 서브해요. 버튼을 누르는 순간이 스윙이에요!', hint: { button: 'normal' },
  done: '샷 버튼을 누르는 순간 바로 쳐요.',
};
const STEP_PERFECT = {
  id: 'perfect', title: 'PERFECT 노리기', text: '붉은 띠 한가운데에 맞추면 PERFECT! 더 강하고 정확한 샷이 나가요.',
  goals: [{ key: 'perfect', need: 1, label: 'PERFECT', accept: (e) => e.type === 'return' && e.grade === 'PERFECT' && e.kind === 'in' }], hint: {},
  done: '띠 가운데일수록 실수가 줄고 샷이 강해져요.',
};
const stepCourse = (how) => ({
  id: 'course', title: '코스 정하기', text: `공이 갈 방향을 정해요. ${how}`,
  goals: [
    { key: 'left', need: 1, label: '왼쪽', accept: (e) => inCourt(e) && e.course === 'left', hint: { lane: 'left' } },
    { key: 'right', need: 1, label: '오른쪽', accept: (e) => inCourt(e) && e.course === 'right', hint: { lane: 'right' } },
  ],
  done: '상대가 없는 쪽으로 보내면 받기 어려워져요.',
});
const STEP_FREE = {
  id: 'free', title: '실전 연습', text: '배운 걸 써서 3점을 먼저 따보세요! 상대가 못 받는 코스와 빠른 탑스핀을 노려요.',
  goals: [{ key: 'win3', need: 3, label: '득점', accept: (e) => e.type === 'point' && e.winner === 'me' }], hint: {},
  done: '',
};

const SIMPLE_STEPS = [
  SIMPLE_SERVE,
  {
    id: 'timing', title: '타이밍 맞추기', text: '공이 튕기면 노란 띠가 나타나요. 공이 띠 안에서 반짝일 때 "일반" 버튼을 누르세요!',
    goals: [{ key: 'return', need: 2, label: '받아치기', accept: inCourt }], hint: { button: 'normal' },
    done: '공이 띠 안에 있을 때 버튼을 누르면 받아쳐요. 일러도 늦어도 안 돼요.',
  },
  STEP_PERFECT,
  stepCourse('코트의 왼쪽을 탭하면 노란 코스 구역이 왼쪽으로 옮겨져요. 그 상태로 공이 오면 버튼을 눌러요. 먼저 왼쪽, 다음엔 오른쪽!'),
  {
    id: 'topspin', title: '탑스핀', text: '공이 띠에 들어오면 "탑스핀" 버튼을 누르세요! 빠르고 낮게 날아가요.',
    goals: [{ key: 'topspin', need: 1, label: '탑스핀', accept: (e) => inCourt(e) && e.spin > 0 }], hint: { button: 'topspin' },
    done: '탑스핀은 빠르고 낮게 날아가 상대를 압박해요 (붉은 궤적).',
  },
  {
    id: 'cut', title: '커트', text: '공이 띠에 들어오면 "커트" 버튼을 누르세요! 느리고 높게 떠요.',
    goals: [{ key: 'cut', need: 1, label: '커트', accept: (e) => inCourt(e) && e.spin < 0 }], hint: { button: 'cut' },
    done: '커트는 느리고 높게 떠서 상대의 강한 공격을 막아요 (푸른 궤적).',
  },
  STEP_FREE,
];

const ADVANCED_STEPS = [
  STEP_SERVE,
  {
    id: 'timing', title: '타이밍 맞추기', text: '공이 튕기면 노란 띠가 나타나요. 공이 띠 안에서 반짝일 때 탭하세요!',
    goals: [{ key: 'return', need: 2, label: '받아치기', accept: inCourt }], hint: {},
    done: '공이 띠 안에 있을 때 탭하면 받아쳐요.',
  },
  STEP_PERFECT,
  stepCourse('탭하는 위치로 정해져요. 먼저 화면 왼쪽, 다음엔 오른쪽을 탭!'),
  {
    id: 'topspin', title: '탑스핀', text: '탭하자마자 위로 "짧게" 쓸어올려요(↑). 빠르고 낮게 날아가요.',
    goals: [{ key: 'topspin', need: 1, label: '탑스핀', accept: (e) => inCourt(e) && e.spin > 0 }], hint: { arrow: 'up' },
    done: '위로 쓸면 탑스핀! 빠르고 낮게 날아가 상대를 압박해요.',
  },
  {
    id: 'cut', title: '커트', text: '탭하자마자 아래로 쓸어내려요(↓). 느리고 높게 떠서 상대의 강타를 막아요.',
    goals: [{ key: 'cut', need: 1, label: '커트', accept: (e) => inCourt(e) && e.spin < 0 }], hint: { arrow: 'down' },
    done: '아래로 쓸면 커트! 느리고 높게 떠요.',
  },
  {
    id: 'power', title: '파워 조절', text: '쓰는 길이가 파워예요. 끝까지 쭉 쓸어보세요! 너무 길면 아웃·네트에 걸릴 수 있어요.',
    goals: [{ key: 'power', need: 1, label: '강타', accept: (e) => e.type === 'return' && e.grade !== 'MISS' && e.power >= 0.85 }], hint: { arrow: 'up', power: true },
    done: '길게 쓸수록 강한 샷! 대신 실수 위험도 커져요. 평소엔 짧게~중간이 안전해요.',
  },
  STEP_FREE,
];

export const TUTORIAL_STEPS = Object.freeze(SIMPLE_STEPS); // 기본(간단 조작) 단계
export const tutorialSteps = (mode) => (mode === 'advanced' ? ADVANCED_STEPS : SIMPLE_STEPS);

/** 실패 원인 피드백 (진행에는 영향 없음) */
export function feedbackFor(e, step) {
  if (e.type === 'missed') return e.reason === 'early' ? '조금 일렀어요! 노란 띠가 반짝일 때 쳐요!' : '늦었어요! 띠가 지나가기 전에 쳐요.';
  if (e.type === 'return') {
    if (e.kind === 'net') return step?.id === 'power' ? '약하게 걸렸어요 — 그래도 길게 쓸어 강타는 성공!' : '공이 네트에 걸렸어요. 조금 더 길게 쓸어 파워를 올려보세요.';
    if (e.kind === 'out') return '너무 세서 아웃! 파워를 줄이거나 위로 쓸어 탑스핀을 걸어보세요.';
    if (e.grade === 'PERFECT') return 'PERFECT!';
    if (e.grade === 'GOOD') return step?.id === 'perfect' ? '좋아요! 붉은 띠 한가운데를 노려보세요.' : '좋아요!';
  }
  return '';
}

export function createTutorial({ mode = 'simple' } = {}) {
  const STEPS = tutorialSteps(mode);
  let index = 0;
  let counts = {};
  let feedback = '';
  let completed = false;
  const step = () => STEPS[index] ?? null;
  const activeGoal = () => step()?.goals.find((g) => (counts[g.key] ?? 0) < g.need) ?? null;
  const view = () => {
    const s = step();
    const g = activeGoal();
    return {
      mode, index, total: STEPS.length, completed, feedback, id: s?.id ?? null, title: s?.title ?? '완료', text: s?.text ?? '',
      hint: { ...(s?.hint ?? {}), ...(g?.hint ?? {}) },
      goals: (s?.goals ?? []).map((x) => ({ key: x.key, label: x.label, need: x.need, got: Math.min(x.need, counts[x.key] ?? 0) })),
    };
  };
  return {
    get view() { return view(); },
    get step() { return step(); },
    get completed() { return completed; },
    /** 이벤트 하나 처리 → { advanced, completed, view } */
    handle(e) {
      if (completed) return { advanced: false, completed: true, view: view() };
      const s = step();
      let progressed = false;
      for (const g of s.goals) {
        if ((counts[g.key] ?? 0) < g.need && g.accept(e)) { counts[g.key] = (counts[g.key] ?? 0) + 1; progressed = true; break; } // 한 이벤트는 목표 하나만 채운다(순서대로)
      }
      const fb = feedbackFor(e, s);
      feedback = progressed ? (e.type === 'return' ? (fb || '좋아요!') : '') : fb;
      let advanced = false;
      if (s.goals.every((g) => (counts[g.key] ?? 0) >= g.need)) {
        index += 1; counts = {}; advanced = true;
        if (index >= STEPS.length) completed = true;
        else feedback = `단계 완료! ${s.done || ''}`.trim(); // 왜 그런지 설명을 함께
      }
      return { advanced, completed, view: view() };
    },
    reset() { index = 0; counts = {}; feedback = ''; completed = false; },
  };
}

/**
 * 튜토리얼 선수 스탯 = 처음 시작하는 선수 수준(4). 간단 조작의 샷 프리셋은 이 스탯에서 성공률이 높다(탑스핀 93~97%).
 */
export const TUTORIAL_STATS = Object.freeze({ power: 4, spin: 4, focus: 4 });

/**
 * 튜토리얼 상대(코치): 약한 공은 98% 받아 줘서 랠리가 이어지고, 강한 샷(탑스핀 30%·강타 50% 미스)에는 점수를 내준다 —
 * 그래서 "강하게 쳐서 점수 따기"가 자연스럽게 학습된다. 스핀·강타는 쓰지 않는다. (수치: 코치 확률 실측, tutorial.test.js)
 */
export const TRAINER_PARAMS = Object.freeze({
  style: 'balanced', league: 'amateur', tier: 'low',
  returnRate: 0.9, accuracy: 0.7, spinUse: 0, courseAim: 0, power: 0.1, counter: false, // 코치는 역습하지 않는다
});

export function createTutorialStore(storage = globalThis.localStorage) {
  let done = false;
  try { done = JSON.parse(storage?.getItem(TUTORIAL_KEY) ?? 'false') === true; } catch { done = false; }
  return {
    get done() { return done; },
    complete() { done = true; try { storage?.setItem(TUTORIAL_KEY, 'true'); } catch { /* 무시 */ } },
    reset() { done = false; try { storage?.removeItem(TUTORIAL_KEY); } catch { /* 무시 */ } },
  };
}
