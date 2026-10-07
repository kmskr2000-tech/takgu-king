// 효과음: WebAudio 로 직접 합성한 칩튠 (파일 없음). 노트 = { f(Hz), d(초), at(시작 오프셋), type, v(볼륨), slide(Hz) }
export const SFX = Object.freeze({
  hit: [{ f: 520, d: 0.04, type: 'square', v: 0.07 }],
  good: [{ f: 600, d: 0.06, type: 'square', v: 0.1 }],
  // PERFECT: 낮은 '퍽' 울림 + 상승 3음 + 반짝 (GOOD 과 확실히 구분되게 길고 크다)
  perfect: [{ f: 140, d: 0.1, type: 'triangle', v: 0.22, slide: -70 }, { f: 660, d: 0.05, type: 'square', v: 0.14 }, { f: 990, d: 0.07, at: 0.05, type: 'square', v: 0.14 }, { f: 1320, d: 0.16, at: 0.11, type: 'square', v: 0.13 }, { f: 1980, d: 0.1, at: 0.17, type: 'triangle', v: 0.08 }],
  bad: [{ f: 330, d: 0.07, type: 'square', v: 0.07 }], // 아슬아슬: 작고 낮게
  miss: [{ f: 220, d: 0.16, type: 'sawtooth', v: 0.1, slide: -110 }],
  pointMe: [{ f: 523, d: 0.08, type: 'square', v: 0.12 }, { f: 659, d: 0.08, at: 0.08, type: 'square', v: 0.12 }, { f: 784, d: 0.16, at: 0.16, type: 'square', v: 0.12 }],
  pointOpp: [{ f: 330, d: 0.12, type: 'triangle', v: 0.14 }, { f: 220, d: 0.22, at: 0.12, type: 'triangle', v: 0.14 }],
  win: [{ f: 523, d: 0.12, type: 'square', v: 0.12 }, { f: 659, d: 0.12, at: 0.12, type: 'square', v: 0.12 }, { f: 784, d: 0.12, at: 0.24, type: 'square', v: 0.12 }, { f: 1047, d: 0.4, at: 0.36, type: 'square', v: 0.12 }],
  lose: [{ f: 392, d: 0.18, type: 'triangle', v: 0.14 }, { f: 330, d: 0.18, at: 0.18, type: 'triangle', v: 0.14 }, { f: 262, d: 0.4, at: 0.36, type: 'triangle', v: 0.14 }],
  counter: [{ f: 880, d: 0.05, at: 0.02, type: 'square', v: 0.1 }, { f: 1320, d: 0.09, at: 0.07, type: 'square', v: 0.1 }], // 상성 유리: 경쾌하게
  // 필살기: 낮은 폭발음 + 치솟는 스윕 + 반짝 (PERFECT 보다 길고 묵직하다) / 준비: 4음 상승 차임
  special: [{ f: 90, d: 0.28, type: 'sawtooth', v: 0.24, slide: -50 }, { f: 300, d: 0.3, type: 'square', v: 0.14, slide: 900 }, { f: 1320, d: 0.08, at: 0.12, type: 'square', v: 0.13 }, { f: 1760, d: 0.1, at: 0.18, type: 'square', v: 0.13 }, { f: 2640, d: 0.22, at: 0.25, type: 'triangle', v: 0.1 }],
  specialReady: [{ f: 784, d: 0.07, type: 'square', v: 0.11 }, { f: 988, d: 0.07, at: 0.07, type: 'square', v: 0.11 }, { f: 1175, d: 0.07, at: 0.14, type: 'square', v: 0.11 }, { f: 1568, d: 0.22, at: 0.21, type: 'square', v: 0.12 }],
  blocked: [{ f: 180, d: 0.1, type: 'triangle', v: 0.14 }], // 상성 불리: 둔탁하게
  click: [{ f: 440, d: 0.03, type: 'square', v: 0.06 }],
});

const defaultFactory = () => {
  const C = globalThis.AudioContext || globalThis.webkitAudioContext;
  return C ? new C() : null;
};

/** enabled(): 설정에서 사운드가 켜져 있는지. ctxFactory: 테스트 주입용 */
export function createAudio({ enabled = () => true, ctxFactory = defaultFactory } = {}) {
  let ctx = null; let suspended = false; const unlockListeners = [];
  return {
    /** 오디오가 (처음) 열렸을 때 불리는 콜백 등록 — 배경음악이 사용자 제스처 뒤에 시작하도록 */
    onUnlock(fn) { unlockListeners.push(fn); },
    get context() { return ctx; },
    /** 광고가 재생되는 동안 효과음을 멈춘다 (광고 훅에서 호출) */
    setSuspended(v) { suspended = !!v; },
    /** 사용자 제스처(탭/클릭) 안에서 호출: 모바일 브라우저는 그때만 오디오를 허용 */
    unlock() {
      try {
        if (!ctx) ctx = ctxFactory();
        if (ctx?.state === 'suspended') ctx.resume?.();
      } catch { ctx = null; }
      if (ctx) for (const fn of unlockListeners) { try { fn(); } catch { /* 무시 */ } }
      return !!ctx;
    },
    get ready() { return !!ctx; },
    /** 재생했으면 true */
    play(name) {
      if (suspended || !enabled() || !ctx || !SFX[name]) return false;
      try {
        const t0 = ctx.currentTime;
        for (const n of SFX[name]) {
          const start = t0 + (n.at ?? 0);
          const osc = ctx.createOscillator(); const gain = ctx.createGain();
          osc.type = n.type ?? 'square';
          osc.frequency.setValueAtTime(n.f, start);
          if (n.slide) osc.frequency.linearRampToValueAtTime(n.f + n.slide, start + n.d);
          gain.gain.setValueAtTime(n.v ?? 0.1, start);
          gain.gain.linearRampToValueAtTime(0.0001, start + n.d);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(start); osc.stop(start + n.d + 0.02);
        }
        return true;
      } catch { return false; }
    },
  };
}
