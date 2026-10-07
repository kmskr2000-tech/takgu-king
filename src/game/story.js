// 스토리: 주인공 페르소나, 리그별 라이벌 대사(첫 등장/경기 전/패배 시/승리 시), 리그별 스토리 비트(도입/연패/중반/관계/결승/우승).
// 출처: ../files/스토리라인.md. DOM 무관 순수 데이터·로직 — 시즌 저장(state.story)에 본 비트·만난 라이벌·라이벌전 패배 수만 기록한다.
import { LEAGUES } from '../core/index.js?v=1791335595';

export const PROTAGONIST = Object.freeze({
  name: '도민구', nickname: '벽치기', age: 29, job: '물류센터 야간 상하차 알바',
  catchphrase: '…다시.',
  bio: '중학교 탁구부 3년 내내 후보. 10년째 새마을 탁구장 구석에서 벽치기만 했다. 지는 데 익숙하고, 그래도 포기는 안 한다.',
});
export const CATCHPHRASE = '…다시.';

/** 라이벌 설정(이름·별명·대사). style 은 게임 AI 의 구질 성향(season.js RIVALS 와 같은 값 — 칩/AI 가 이걸 쓴다) */
export const RIVAL_STORY = Object.freeze({
  amateur: {
    name: '오순자', nickname: '철벽 오여사', age: 64, style: 'cut', role: '새마을 탁구장 사장 · 동호회장',
    blurb: '30년째 커트 전형. 민구의 벽치기를 10년간 몰래 지켜봤다.',
    lines: {
      first: '벽이 불쌍하다, 얘. 10년을 맞았으면 이제 쉬게 해 줘야지.',
      pre: '공 밑을 봐. 내 공은 다 아래로 깎여 있어. 그게 커트야.',
      lose: '봐라, 네트에 다 걸리지? 커트는 들어 올려야 넘어가. 다시 와.',
      win: '…아이고, 이 할미가 10년 키운 보람이 있네. 3부 가서 밥은 챙겨 먹어.',
    },
  },
  third: {
    name: '차하늘', nickname: '광속 하늘', age: 17, style: 'balanced', role: '고등학생 · 전국 유소년 랭킹 1위 출신',
    blurb: '빠른 탑스핀 연타. 사실은 크게 져 본 적이 없어서 지는 게 무섭다.',
    lines: {
      first: '아저씨 몇 살이에요? 스물아홉? 와, 탁구 시작하기엔 좀… 아니, 응원할게요 ㅋ',
      pre: '3초 안에 끝내 드릴게요. 눈 깜빡이지 마세요.',
      lose: '봤죠? 이게 속도예요. …근데 아저씨 왜 웃어요? 졌는데?',
      win: '…말도 안 돼. 나 진 거예요? …다시 해요. 다시! 아저씨는 맨날 이렇게 다시 했던 거예요?',
    },
  },
  second: {
    name: '마도철', nickname: '메트로놈', age: 41, style: 'balanced', role: '전직 실업팀 주전 · 동네 레슨 코치',
    blurb: '박자를 늦췄다 당기며 리듬을 흔들고, 끝선과 몸쪽을 찌른다. 한 번의 패배로 "다시"를 멈춘 사람.',
    lines: {
      first: '아, 그 벽치기 친구? 소문 들었어요. 커피 한 잔 해요. 시합은 대충 하고.',
      pre: '하나, 둘, 셋에 칠 것 같죠? 난 둘에서 칩니다.',
      lose: '박자를 쫓아오면 늦어요. 듣고, 기다리고, 그다음에 치는 거예요.',
      win: '…허, 오랜만에 분하네. 이 기분 7년 만이에요. 고마워요, 진짜로.',
    },
  },
  first: {
    name: '서유나', nickname: '영원한 후보', age: 24, style: 'balanced', role: '4년째 국가대표 후보 · 데이터 분석 덕후',
    blurb: '커트·드라이브·리듬 변화를 다 하고 상대 약점에 맞춰 구질을 바꾼다. 늘 2등이었다.',
    lines: {
      first: '도민구 씨. 리턴 성공률 91%, 공격 전환율 12%. …벽이네요, 진짜.',
      pre: '당신 데이터는 다 있어요. 오늘은 예측대로 끝날 거예요.',
      lose: '예측대로네요. …근데 지난번보다 3% 올랐어요. 기분 나쁘게.',
      win: '…노트에 없는 공이었어요. 나도 \'후보\' 말고, 나로 쳐 볼게요. 세계대회에서 봐요.',
    },
  },
  world: {
    name: '제노 아르덴', nickname: '황제', age: 26, style: 'balanced', role: '프로 데뷔 후 7년 공식전 무패',
    blurb: '모든 구질을 받아치고 상대 스타일을 복사해 되돌려 주는 \'움직이는 벽\'. 연습 상대가 없어 혼자 벽과 훈련한다.',
    lines: {
      first: '당신도 벽이랑 쳤다면서요. …나도요. 반가워요.',
      pre: '제발, 끝까지 넘겨 줘요. 랠리가 길었던 적이 없어서.',
      lose: '고마웠어요. …다음? 그게 뭔지 잘 몰라서요.',
      win: '……이게, 지는 거군요. 이상하네. 하나도 안 아파요. …저기, 한 판 더. 다시요.',
    },
  },
});

/** 세계대회 결승에서 질 때마다 관중석 동료가 한마디씩 건넨다 (패배 횟수대로 순환) */
export const WORLD_ALLIES = Object.freeze([
  { name: '오순자', text: '다시 와.' },
  { name: '마도철', text: '박자 들어요.' },
  { name: '차하늘', text: '다시 해요, 아저씨!' },
]);

/**
 * 스토리 비트: 시즌 진행(주차)에 맞춰 한 번씩 나오는 컷. 키 = `${league}:${id}` 로 저장(리그당 한 번, 같은 리그 재도전 시 반복 안 함).
 *  intro: 시즌 시작 화면 / early: 3주차(연패·첫 시합) / mid: 5주차 / bond: 7주차(관계 진전, 없으면 null) / final: 연말 토너먼트 진입 / clear: 우승 직후(시즌 결과 화면)
 */
export const BEAT_ORDER = Object.freeze(['intro', 'early', 'mid', 'bond', 'final', 'clear']);
export const BEAT_WEEK = Object.freeze({ early: 3, mid: 5, bond: 7 });
export const BEAT_LABEL = Object.freeze({ intro: '도입', early: '연패 구간', mid: '중반', bond: '관계 진전', final: '결승', clear: '우승' });

export const LEAGUE_STORY = Object.freeze({
  amateur: {
    title: '벽 밖으로', beats: {
      intro: { title: '새벽 탁구장', text: '새벽 탁구장, 벽치기 1만 번째 랠리. 오순자가 대회 신청서를 내민다.\n“벽이랑은 이제 그만 놀고, 사람이랑 쳐 봐.”' },
      early: { title: '첫 패배', text: '첫 패배. 벽과 달리 사람은 공을 깎고 비튼다.\n민구가 중얼거린다. “벽은 공을 안 깎던데.”', quote: CATCHPHRASE },
      mid: { title: '구질을 익히다', text: '동호회원들과 연습하며 일반, 커트, 탑스핀을 하나씩 익힌다. 공을 넘기는 것과 시합은 다르다.' },
      bond: { title: '10년의 시선', text: '오순자가 10년 동안 벽치기를 지켜봤다는 걸 알게 된다.\n“네 리턴은 이미 프로야. 보내는 걸 몰랐을 뿐.”' },
      final: { title: '철벽 커트', text: '연말 토너먼트. 철벽 오여사의 무거운 커트가 기다린다. 공 밑을 보고, 들어 올려서 넘기자.' },
      clear: { title: '3부 등록증', text: '철벽 커트를 들어 올려 넘겼다. 오순자가 3부 등록증을 붙여 준다.\n“밥은 챙겨 먹어.”' },
    },
  },
  third: {
    title: '빠른 놈, 느린 놈', beats: {
      intro: { title: '첫 경기장', text: '3부 첫 경기장 입장. 차하늘이 다가온다.\n“아저씨 몇 살이에요?”' },
      early: { title: '손도 못 대고', text: '드라이브 연타에 손도 못 대고 진다. 오순자의 조언이 떠오른다.\n“빠른 공도 박자는 있어.”', quote: CATCHPHRASE },
      mid: { title: '하늘의 첫 패배', text: '학교 대회에서 처음 지고 무너진 하늘을 민구가 본다.\n“난 그거 매일 해. 별거 없어.”' },
      bond: { title: '새벽 연습', text: '하늘이 몰래 민구의 새벽 연습에 따라 나온다. 투닥거리는, 사제 아닌 사제 관계가 된다.' },
      final: { title: '타이밍 카운터', text: '연말 토너먼트. 속도에 겁먹지 말고 타이밍을 맞추자.\n“빨라도 결국 같은 박자야.”' },
      clear: { title: '하늘의 눈물', text: '타이밍 카운터로 이겼다. 하늘이 처음으로 “다시!”를 외치며 운다. 웃으면서.' },
    },
  },
  second: {
    title: '멈춘 사람', beats: {
      intro: { title: '메트로놈', text: '2부 체육관. \'메트로놈\' 마도철은 시합보다 커피를 먼저 권하는 이상한 아저씨다.' },
      early: { title: '끌려다니다', text: '박자를 빼앗겨 계속 헛스윙한다.\n“치는 게 아니라 끌려다니네요.”', quote: CATCHPHRASE },
      mid: { title: '그의 레슨장', text: '도철의 레슨장을 찾아가 은퇴 사연을 듣는다.\n“한 번 지니까, 다시가 안 되더라고요.”' },
      bond: { title: '매주 오는 사람', text: '수십 번 지고도 매주 오는 민구를 보고, 도철이 몰래 재활 훈련을 다시 시작한다.' },
      final: { title: '진심 모드', text: '연말 토너먼트. 도철이 처음으로 진심이다. 이 사람, 숨 쉬는 박자로 친다. 듣고, 기다리고, 치자.' },
      clear: { title: '1부로', text: '도철의 리듬을 듣고 이겼다.\n“1부 가요. 나도 따라갈 테니까.”' },
    },
  },
  first: {
    title: '2등들의 리그', beats: {
      intro: { title: '개막전', text: '1부 개막전. 서유나가 민구의 데이터를 읊으며 등장한다. 그녀는 4년째 국가대표 \'후보\'다.' },
      early: { title: '읽히는 공', text: '모든 공이 읽힌다. 분석 앞에 민구의 리턴이 무력해진다.', quote: CATCHPHRASE },
      mid: { title: '후보 3년', text: '민구가 중학교 \'후보 3년\' 이야기를 꺼낸다. 유나가 처음으로 노트를 덮는다.' },
      bond: { title: '단 하나', text: '유나가 상성표를 보여 준다.\n“당신은 뭘 해도 어중간해요. 단 하나만 빼고.”\n민구가 벽치기 리턴을 자기 무기로 정한다.' },
      final: { title: '노트에 없는 공', text: '연말 토너먼트.\n“다 잘하는 사람한텐, 내가 제일 잘하는 걸로.”' },
      clear: { title: '나로 치다', text: '노트에 없는 공으로 이겼다. 유나가 대표 선발 대신 \'내 스타일\'을 찾겠다고 선언하고, 세계대회 동행을 약속한다.' },
    },
  },
  world: {
    title: '마지막 벽', beats: {
      intro: { title: '무패 7년', text: '세계대회 입장. 관중석에 오순자, 하늘, 도철, 유나가 모였다. 전광판에 \'황제 제노, 무패 7년\'.' },
      early: { title: '총동원', text: '각국 강자들을 돌파한다. 구질, 타이밍, 리듬, 상성 — 배운 걸 전부 쓴다.' },
      mid: { title: '같은 소리', text: '새벽 연습장에서 혼자 벽치기하는 제노를 본다. 같은 소리, 같은 박자. 둘이 말없이 랠리를 시작한다.' },
      bond: null,
      final: { title: '움직이는 벽', text: '연말 토너먼트 결승 무대. 제노가 민구의 스타일을 복사한다.\n질 때마다 관중석에서 한마디씩 날아온다.' },
      clear: { title: '다시', text: '마지막 랠리를 벽에게서 배운 리턴으로 끝까지 넘겨 승리한다.\n제노가 웃으며 말한다. “…다시요.”\n민구가 대답한다. “그래, 다시.”' },
    },
  },
});

// ---- 상태 ----
/** state.story 보장. 예전 저장(story 없음)은 지금 주차까지 지나간 비트를 본 것으로 처리해 한꺼번에 쏟아지지 않게 한다 */
export function ensureStory(state) {
  if (state.story && Array.isArray(state.story.seen)) return state.story;
  state.story = { seen: [], met: [], rivalLosses: {} };
  if (state.league) {
    const lg = state.league;
    const mark = (id) => state.story.seen.push(`${lg}:${id}`);
    mark('intro');
    if (state.phase === 'regular') for (const [id, w] of Object.entries(BEAT_WEEK)) if ((state.week ?? 1) > w) mark(id);
    if (state.phase === 'tournament' || state.phase === 'seasonEnd') { for (const id of ['early', 'mid', 'bond', 'final']) mark(id); }
  }
  return state.story;
}
const key = (league, id) => `${league}:${id}`;
export const beatSeen = (state, id, league = state.league) => ensureStory(state).seen.includes(key(league, id));
export function markBeat(state, id, league = state.league) { const s = ensureStory(state); if (!s.seen.includes(key(league, id))) s.seen.push(key(league, id)); }
export const beatOf = (league, id) => LEAGUE_STORY[league]?.beats[id] ?? null;

const hasRegularLoss = (state) => (state.log ?? []).some((g) => g.stage === 'regular' && g.a === 0 && g.winner !== 0);
const rivalId = (state) => state.teams?.find((t) => t.rival)?.id ?? null;
const inBracket = (state, id) => !!state.bracket && id != null && [...state.bracket.semis, state.bracket.final].some((m) => m.a === id || m.b === id);
const meInBracket = (state) => inBracket(state, 0);
const GENERIC_FINAL = { title: '연말 토너먼트', text: '연말 토너먼트. 지금까지 배운 걸 믿고, 한 판씩 넘기자.' };
const GENERIC_CLEAR = { title: '우승', text: '우승했다. 지고, 다시 하고, 또 졌던 시간이 여기까지 데려왔다.' };

/**
 * 지금 보여줄 비트(주차 조건을 만족한 가장 이른 미확인 비트). 시작 화면의 intro 와 시즌 결과의 clear 는 각자의 화면에서 처리하므로 제외.
 *  - early(연패 구간)는 정규 시즌에서 한 번이라도 졌을 때만. 5주차까지 무패면 건너뛴다(뒤 비트를 막지 않는다).
 *  - final 은 내가 토너먼트에 올랐을 때만. 라이벌이 대진에 없으면 라이벌 언급이 없는 문구로 바꾼다.
 */
export function pendingBeat(state) {
  if (state.phase === 'seasonEnd') return null;
  const lg = state.league;
  const wk = state.phase === 'regular' ? state.week : 99;
  for (const id of ['early', 'mid', 'bond', 'final']) {
    const b = beatOf(lg, id);
    if (!b || beatSeen(state, id)) continue;
    let ready;
    if (id === 'final') { if (state.phase !== 'tournament') break; if (!meInBracket(state)) continue; ready = true; }
    else if (id === 'early') {
      if (hasRegularLoss(state) && wk >= BEAT_WEEK.early) ready = true;
      else if (wk >= BEAT_WEEK.mid) continue; // 졌던 적 없이 중반까지 왔다 → 연패 컷은 건너뜀
      else break;
    } else ready = wk >= BEAT_WEEK[id];
    if (!ready) break; // 순서대로만
    const text = id === 'final' && !inBracket(state, rivalId(state)) ? GENERIC_FINAL : b;
    return { id, label: BEAT_LABEL[id], league: lg, leagueTitle: LEAGUE_STORY[lg].title, ...text, ...(text === b ? {} : { quote: undefined }) };
  }
  return null;
}

/** 시즌 시작 화면용 intro 비트 (이 리그에서 처음일 때만) */
export function introBeat(state) {
  if (beatSeen(state, 'intro')) return null;
  const b = beatOf(state.league, 'intro');
  return b ? { id: 'intro', label: BEAT_LABEL.intro, league: state.league, leagueTitle: LEAGUE_STORY[state.league].title, ...b } : null;
}
/** 우승 직후 비트 (시즌 결과 화면). 이미 봤으면 null */
export function clearBeat(state, league) {
  if (beatSeen(state, 'clear', league)) return null;
  let b = beatOf(league, 'clear');
  if (b && state.league === league && state.bracket && !inBracket(state, rivalId(state))) b = GENERIC_CLEAR; // 라이벌과 겨루지 않고 우승했다면 라이벌 언급 없이
  return b ? { id: 'clear', label: BEAT_LABEL.clear, league, leagueTitle: LEAGUE_STORY[league].title, ...b } : null;
}

// ---- 라이벌 대사 ----
export const rivalStory = (league) => RIVAL_STORY[league] ?? null;

/**
 * 라이벌전 직전 컷: 처음 만나면 '첫 등장' 대사 + '경기 전' 대사, 이후엔 '경기 전' 대사만. 만난 걸로 저장한다.
 * 반환 { rival, lines:[{who,text}], first } (라이벌전이 아니면 null)
 */
export function rivalPreMatch(state, opp) {
  const r = opp?.rival ? rivalStory(state.league) : null;
  if (!r) return null;
  const s = ensureStory(state);
  const first = !s.met.includes(state.league);
  if (first) s.met.push(state.league);
  const lines = [...(first ? [{ who: r.name, text: r.lines.first }] : []), { who: r.name, text: r.lines.pre }];
  return { rival: r, lines, first };
}

/**
 * 라이벌전 직후 컷: 이기면 승리 대사, 지면 패배 대사 + 주인공의 "…다시.". 세계대회 결승에서 지면 동료의 한마디가 붙는다. 패배 횟수를 센다.
 * 라이벌전이 아니면 null — 지기만 한 경기도 "…다시." 는 결과 화면이 따로 보여 준다.
 */
export function rivalPostMatch(state, opp, won, { final = true } = {}) {
  const r = opp?.rival ? rivalStory(state.league) : null;
  if (!r) return null;
  const s = ensureStory(state);
  // 승리 대사는 "리그를 가르는 결승"에서만 (정규 시즌·4강의 승리엔 3부 가라/세계대회에서 보자 같은 대사가 어긋난다). 패배 대사는 언제든 어울린다
  const lines = won ? (final ? [{ who: r.name, text: r.lines.win }] : []) : [{ who: r.name, text: r.lines.lose }];
  if (!won) {
    const n = s.rivalLosses[state.league] = (s.rivalLosses[state.league] ?? 0) + 1;
    if (state.league === 'world') { const a = WORLD_ALLIES[(n - 1) % WORLD_ALLIES.length]; lines.push({ who: a.name, text: a.text }); }
    lines.push({ who: PROTAGONIST.name, text: CATCHPHRASE });
  }
  return { rival: r, lines, won };
}

export const isStoryLeague = (l) => LEAGUES.includes(l);
