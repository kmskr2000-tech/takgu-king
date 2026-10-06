// 배경음악: 효과음처럼 WebAudio 로 직접 합성하는 칩튠 루프 (파일 없음). 트랙은 순수 데이터 → 스케줄러가 재생.
// 음은 { beat(루프 안 시작 박), dur(박), f(Hz)|null, voice } 로 펼친다. 박 단위라 템포(bpm)만 바꾸면 빨라진다.
const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'A4' → 440 Hz, 'C#5' · 'Bb3' 지원 */
export function noteHz(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`음 이름 오류: ${name}`);
  const midi = 12 * (Number(m[3]) + 1) + NOTE_INDEX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * 2 ** ((midi - 69) / 12);
}

/** 'E5:1 G5:1 C6:2 _:1' → 이어 붙인 음 목록 ( _ = 쉼표). start 박부터 */
function seq(text, voice, start = 0) {
  const out = []; let beat = start;
  for (const tok of text.trim().split(/\s+/)) {
    const [name, d] = tok.split(':'); const dur = Number(d);
    if (name !== '_') out.push({ beat, dur, f: noteHz(name), voice });
    beat += dur;
  }
  return out;
}
const bars = (list, perBar = 4) => list.map((b, i) => seq(b, 'x', i * perBar)); // 소절 목록 → (voice 는 나중에 지정)
const voiced = (barNotes, voice) => barNotes.flat().map((n) => ({ ...n, voice }));
/** 매 박의 뒷박(.5)에 하이햇, 2·4박에 스네어 */
function drums(beatsTotal, { snare = false, hat = true } = {}) {
  const out = [];
  for (let b = 0; b < beatsTotal; b++) {
    if (hat) out.push({ beat: b + 0.5, dur: 0.05, f: null, voice: 'hat' });
    if (snare && b % 2 === 1) out.push({ beat: b, dur: 0.12, f: null, voice: 'snare' });
  }
  return out;
}

// ── 메뉴(타이틀·홈): 밝고 느긋한 C 장조, 8소절(32박) ──
const TITLE_LEAD = bars([
  'E5:1 G5:1 C6:2', 'A5:1 G5:1 E5:2', 'F5:1 A5:1 C6:1 A5:1', 'G5:1 B5:1 D6:2',
  'E6:1 D6:1 C6:1 G5:1', 'A5:1 C6:1 F6:2', 'D6:1 B5:1 G5:1 B5:1', 'C6:3 _:1',
]);
const TITLE_BASS = bars([
  'C3:1 C3:1 G3:1 C3:1', 'A2:1 A2:1 E3:1 A2:1', 'F2:1 F2:1 C3:1 F2:1', 'G2:1 G2:1 D3:1 G2:1',
  'C3:1 C3:1 G3:1 C3:1', 'F2:1 F2:1 C3:1 F2:1', 'G2:1 G2:1 D3:1 G2:1', 'C3:2 G2:1 C3:1',
]);
// ── 경기: 빠르고 긴장감 있는 A 단조, 8소절(32박). 앞 4소절은 8분음표 아르페지오, 뒤 4소절은 멜로디 ──
const arp = (a, b, c) => `${a}:0.5 ${b}:0.5 ${c}:0.5 ${b}:0.5 ${a}:0.5 ${b}:0.5 ${c}:0.5 ${b}:0.5`;
const MATCH_LEAD = bars([
  arp('A5', 'C6', 'E6'), arp('F5', 'A5', 'C6'), arp('C6', 'E6', 'G6'), arp('G5', 'B5', 'D6'),
  'A5:1 C6:1 E6:1 A6:1', 'F5:1 A5:1 C6:1 F6:1', 'E6:1 G6:1 E6:1 C6:1', 'D6:1.5 B5:0.5 G5:2',
]);
const eighths = (root, fifth) => `${root}:0.5 ${root}:0.5 ${fifth}:0.5 ${root}:0.5 ${root}:0.5 ${root}:0.5 ${fifth}:0.5 ${root}:0.5`;
const MATCH_BASS = bars([
  eighths('A2', 'E3'), eighths('F2', 'C3'), eighths('C3', 'G3'), eighths('G2', 'D3'),
  eighths('A2', 'E3'), eighths('F2', 'C3'), eighths('C3', 'G3'), eighths('G2', 'D3'),
]);

export const TRACKS = Object.freeze({
  title: { bpm: 112, beats: 32, notes: [...voiced(TITLE_LEAD, 'lead'), ...voiced(TITLE_BASS, 'bass'), ...drums(32)] },
  match: { bpm: 144, beats: 32, notes: [...voiced(MATCH_LEAD, 'lead'), ...voiced(MATCH_BASS, 'bass'), ...drums(32, { snare: true })] },
});

/** 루프 [from, to) 박 구간(절대 박, 루프를 여러 번 돌 수 있음)에 시작하는 음들 — 각 음에 절대 박 `at` 을 붙여 돌려준다 */
export function notesInRange(track, from, to) {
  const out = [];
  const first = Math.floor(from / track.beats);
  const last = Math.floor((to - 1e-9) / track.beats);
  for (let loop = first; loop <= last; loop++) {
    for (const n of track.notes) {
      const at = loop * track.beats + n.beat;
      if (at >= from && at < to) out.push({ ...n, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

const VOICE = Object.freeze({
  lead: { type: 'square', v: 0.035 },
  bass: { type: 'triangle', v: 0.075 },
});
const LOOKAHEAD = 0.5; // 초: 미리 예약해 두는 길이
const TICK_MS = 120;

/**
 * 스케줄러. getCtx(): 사용자 제스처 뒤에 만들어진 AudioContext (없으면 아직 못 연주 — 열리면 sync() 로 이어서 시작).
 * enabled(): 설정(사운드·배경음악)이 켜져 있는지. timer: 테스트 주입용 { set, clear }.
 */
export function createBgm({ getCtx, enabled = () => true, timer = { set: (fn, ms) => setInterval(fn, ms), clear: (id) => clearInterval(id) } }) {
  let want = null; // 원하는 트랙 이름
  let playing = null; let suspended = false; let id = null;
  let startTime = 0; let cursor = 0; let master = null; let noiseBuf = null;

  const noise = (ctx) => {
    if (noiseBuf) return noiseBuf;
    const len = Math.floor(ctx.sampleRate * 0.15); const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = buf);
  };

  function schedule(ctx, track, n, when, spb) {
    const dur = Math.max(0.03, n.dur * spb);
    if (n.voice === 'hat' || n.voice === 'snare') {
      if (!ctx.createBufferSource) return;
      const src = ctx.createBufferSource(); const g = ctx.createGain();
      src.buffer = noise(ctx);
      const v = n.voice === 'snare' ? 0.05 : 0.018;
      g.gain.setValueAtTime(v, when); g.gain.linearRampToValueAtTime(0.0001, when + (n.voice === 'snare' ? 0.12 : 0.04));
      src.connect(g); g.connect(master); src.start(when); src.stop(when + 0.15);
      return;
    }
    const cfg = VOICE[n.voice]; const osc = ctx.createOscillator(); const g = ctx.createGain();
    osc.type = cfg.type; osc.frequency.setValueAtTime(n.f, when);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(cfg.v, when + 0.01);
    g.gain.setValueAtTime(cfg.v, when + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, when + dur * 0.95);
    osc.connect(g); g.connect(master); osc.start(when); osc.stop(when + dur);
  }

  function tick() {
    const ctx = getCtx?.();
    if (!ctx || !playing || suspended || !enabled()) return;
    const track = TRACKS[playing]; const spb = 60 / track.bpm;
    const horizon = (ctx.currentTime + LOOKAHEAD - startTime) / spb; // 예약해야 할 마지막 박
    if (horizon > cursor) {
      for (const n of notesInRange(track, cursor, horizon)) schedule(ctx, track, n, startTime + n.at * spb, spb);
      cursor = horizon;
    }
  }

  function stopTimer() { if (id != null) { timer.clear(id); id = null; } }

  function begin() {
    const ctx = getCtx?.();
    if (!ctx || !want || suspended || !enabled()) return false;
    if (playing === want && id != null) return true;
    stopTimer();
    playing = want;
    if (!master) { master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination); }
    startTime = ctx.currentTime + 0.05; cursor = 0;
    id = timer.set(tick, TICK_MS); tick();
    return true;
  }

  return {
    /** 트랙 지정: 같은 트랙이면 계속 재생(끊김 없음), 다르면 처음부터. 오디오가 아직 안 열렸으면 열릴 때 시작 */
    play(name) {
      if (!TRACKS[name]) return false;
      if (want !== name) { want = name; if (playing !== name) { stopTimer(); playing = null; } }
      return begin();
    },
    /** 설정이 바뀌었거나 오디오가 열렸을 때: 켜져 있으면 시작, 꺼져 있으면 멈춤 */
    sync() { if (enabled()) begin(); else stopTimer(), (playing = null); },
    stop() { want = null; stopTimer(); playing = null; },
    /** 광고·백그라운드 탭 동안 일시정지 (풀면 이어서 시작) */
    setSuspended(v) { suspended = !!v; if (suspended) { stopTimer(); playing = null; } else begin(); },
    get track() { return playing; },
    get wanted() { return want; },
    get running() { return id != null; },
  };
}
