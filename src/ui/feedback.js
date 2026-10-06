// 경기 이벤트 → 효과음 + 진동. 설정(사운드/진동)은 호출 시점마다 확인한다.
export const VIBRATION = Object.freeze({
  perfect: [15], good: [8], bad: [6], miss: [40], counter: [10, 20, 10], blocked: [30], pointMe: [20, 40, 20], pointOpp: [70], win: [30, 50, 30, 50, 90], lose: [120],
});

export function createHaptics({ enabled = () => true, nav = globalThis.navigator } = {}) {
  return {
    play(name) {
      if (!enabled() || !VIBRATION[name] || typeof nav?.vibrate !== 'function') return false;
      try { return nav.vibrate(VIBRATION[name]) !== false; } catch { return false; }
    },
  };
}

/** 이벤트 하나에 해당하는 피드백 이름들 (순수 함수) */
export function feedbackFor(e) {
  switch (e.type) {
    case 'grade': {
      const base = e.grade === 'PERFECT' ? 'perfect' : e.grade === 'GOOD' ? 'good' : e.grade === 'BAD' ? 'bad' : 'miss';
      if (e.grade === 'MISS') return [base];
      return e.matchup === 'win' ? [base, 'counter'] : e.matchup === 'lose' ? [base, 'blocked'] : [base]; // 상성 즉시 피드백(설계안 §4.4)
    }
    case 'hit': return ['hit'];
    case 'point': return [e.winner === 'me' ? 'pointMe' : 'pointOpp'];
    case 'end': return [e.winner === 'me' ? 'win' : 'lose'];
    default: return [];
  }
}

export function react(e, { audio, haptics }) {
  for (const name of feedbackFor(e)) { audio?.play(name); haptics?.play(name); }
}
