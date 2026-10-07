// 경기 이벤트 → 효과음 + 진동. 설정(사운드/진동)은 호출 시점마다 확인한다.
export const VIBRATION = Object.freeze({
  perfect: [30, 20, 15, 20, 60], good: [8], bad: [6], miss: [40], counter: [10, 20, 10], blocked: [30], special: [60, 30, 40, 30, 120], specialReady: [15, 25, 15, 25, 40], pointMe: [20, 40, 20], pointOpp: [70], win: [30, 50, 30, 50, 90], lose: [120],
});

const GAP_MS = 40;

export function createHaptics({ enabled = () => true, nav = globalThis.navigator } = {}) {
  return {
    play(name) {
      if (!enabled() || !VIBRATION[name] || typeof nav?.vibrate !== 'function') return false;
      try { return nav.vibrate(VIBRATION[name]) !== false; } catch { return false; }
    },
    /**
     * 한 이벤트의 진동 여럿을 한 번의 vibrate 로 이어 붙인다. navigator.vibrate 는 호출할 때마다 앞 패턴을 끊어서,
     * PERFECT+카운터처럼 둘을 따로 부르면 PERFECT 가 거의 느껴지지 않았다. 패턴은 모두 '진동'으로 끝나므로 사이에 쉼(GAP_MS)만 넣으면 이어진다.
     */
    playAll(names) {
      const list = names.filter((n) => VIBRATION[n]);
      if (!list.length) return false;
      if (list.length === 1) return this.play(list[0]);
      if (!enabled() || typeof nav?.vibrate !== 'function') return false;
      const pattern = list.flatMap((n, i) => (i ? [GAP_MS, ...VIBRATION[n]] : VIBRATION[n]));
      try { return nav.vibrate(pattern) !== false; } catch { return false; }
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
    case 'special': return ['special']; // 필살기 발사
    case 'specialReady': return ['specialReady']; // 3연속 PERFECT 달성
    case 'point': return [e.winner === 'me' ? 'pointMe' : 'pointOpp'];
    case 'end': return [e.winner === 'me' ? 'win' : 'lose'];
    default: return [];
  }
}

export function react(e, { audio, haptics }) {
  const names = feedbackFor(e);
  for (const name of names) audio?.play(name);
  if (haptics?.playAll) haptics.playAll(names); else for (const name of names) haptics?.play(name);
}
