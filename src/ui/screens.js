import { h } from './dom.js?v=1791288146';
import { ICON_PADDLE, ICON_PALETTE, drawSprite } from './sprites.js?v=1791288146';
import { drawLogo, LOGO_W, LOGO_H, LOGO_TEXT } from './logo.js?v=1791288146';
import { drawTitleBackground, TB_W, TB_H } from './titlebg.js?v=1791288146';
import { SHOT_TYPES, SHOT_ORDER } from '../game/controls.js?v=1791288146';
import { drawRuleDiagram, ruleCards, DIAGRAM_W, DIAGRAM_H } from './rules.js?v=1791288146';
import {
  LEAGUE_NAMES, RIVALS, standings, nextMatch, GRIPS, RACKETS, effectiveStats, unlockCondition,
} from '../game/season.js?v=1791288146';

const STAT_INFO = {
  power: { label: '파워', desc: '스매시 위력↑, 상대 리턴 난이도↑' },
  spin: { label: '스핀', desc: '회전량↑, 스핀 샷 효과↑' },
  focus: { label: '집중', desc: '타이밍 판정 구간↑, 실수율↓' },
};

const btn = (text, onclick, cls = '') => h('button', { class: `btn ${cls}`.trim(), onclick, type: 'button' }, text);

/** 도트 로고: 캔버스에 직접 그린 글자. 스크린리더/검색용 텍스트는 숨겨서 함께 둔다 */
function pixelLogo() {
  const cv = h('canvas', { class: 'logo-canvas', 'aria-hidden': 'true', width: LOGO_W, height: LOGO_H });
  cv.width = LOGO_W; cv.height = LOGO_H;
  const c = cv.getContext?.('2d');
  if (c) { c.imageSmoothingEnabled = false; drawLogo(c); }
  return h('h1', { class: 'logo-pixel' }, cv, h('span', { class: 'sr-only' }, LOGO_TEXT));
}

/** 타이틀 배경: 화면 전체를 덮는 도트 경기장 (장식이라 스크린리더에서 숨김) */
function titleBackground() {
  const cv = h('canvas', { class: 'title-bg-canvas', width: TB_W, height: TB_H });
  cv.width = TB_W; cv.height = TB_H;
  const c = cv.getContext?.('2d');
  if (c) { c.imageSmoothingEnabled = false; drawTitleBackground(c); }
  return h('div', { class: 'title-bg', 'aria-hidden': 'true' }, cv);
}

/** 인트로 화면: 전체 화면 캔버스 + 타이핑 자막 + 건너뛰기. 화면 어디든 탭하면 건너뜀 */
export function introScreen({ canvas, onSkip }) {
  const caption = h('div', { class: 'intro-caption', 'aria-live': 'polite' }, '');
  const skip = h('button', { class: 'intro-skip', type: 'button', onclick: onSkip }, '건너뛰기 ▶');
  const el = h('section', { class: 'screen intro', onpointerdown: onSkip },
    h('div', { class: 'intro-stage' }, canvas), caption, skip,
    h('div', { class: 'intro-hint' }, '화면을 탭하면 건너뜁니다'));
  return { el, setCaption(text) { caption.textContent = text; } };
}

export function titleScreen({ hasSave, onContinue, onNew, onTutorial = null, onSettings, onRules }) {
  const icon = h('canvas', { class: 'icon', width: 16, height: 16 });
  icon.width = 16; icon.height = 16;
  const ictx = icon.getContext?.('2d');
  if (ictx) { ictx.imageSmoothingEnabled = false; drawSprite(ictx, ICON_PADDLE, ICON_PALETTE, 0, 0); }
  return h('section', { class: 'screen title' },
    titleBackground(),
    icon,
    pixelLogo(),
    h('p', { class: 'sub' }, '지면 다시. 한 점씩, 한 경기씩.'),
    btn('새로 시작', onNew, 'primary'),
    // 이어하기는 항상 새로 시작 바로 아래. 저장된 시즌이 없으면 비활성
    h('button', {
      class: `btn${hasSave ? ' primary' : ''}`, type: 'button', disabled: hasSave ? null : true,
      'aria-disabled': hasSave ? null : 'true', onclick: hasSave ? onContinue : null,
    }, '이어하기'),
    onTutorial && btn('튜토리얼', onTutorial),
    btn('설정', onSettings),
    btn('룰 설명', onRules));
}

export function settingsScreen({ defs, values, onToggle, onReset, onBack }) {
  const row = (d) => {
    if (d.type === 'enum') { // 값이 여러 개인 항목: 누를 때마다 다음 값으로
      const cur = d.options.find((o) => o.value === values[d.key]) ?? d.options[0];
      return h('button', { class: 'btn setting enum on', type: 'button', onclick: () => onToggle(d.key) },
        h('span', { class: 'sname' }, d.label), h('span', { class: 'sstate' }, `${cur.label} ▸`), h('small', {}, `${cur.desc} · 누르면 바뀜`));
    }
    return h('button', {
      class: `btn setting${values[d.key] ? ' on' : ''}`, type: 'button', 'aria-pressed': values[d.key] ? 'true' : 'false',
      onclick: () => onToggle(d.key),
    }, h('span', { class: 'sname' }, d.label), h('span', { class: 'sstate' }, values[d.key] ? '켜짐' : '꺼짐'), h('small', {}, d.desc));
  };
  return h('section', { class: 'screen settings' },
    h('h2', {}, '설정'),
    defs.map(row),
    btn('저장 데이터 삭제', onReset, 'danger'),
    btn('돌아가기', onBack, 'primary'));
}

/** 룰 설명(그림): 도트 다이어그램 카드 6장. 반환 { el, draw(t) } — 앱이 프레임마다 draw(t) 로 그림을 움직인다 */
export function rulesScreen({ onBack, mode = 'simple' }) {
  const canvases = [];
  const cards = ruleCards(mode).map((c) => {
    const cv = h('canvas', { class: 'rule-canvas', width: DIAGRAM_W, height: DIAGRAM_H, 'aria-hidden': 'true' });
    cv.width = DIAGRAM_W; cv.height = DIAGRAM_H;
    const g = cv.getContext?.('2d'); if (g) g.imageSmoothingEnabled = false;
    canvases.push({ id: c.id, g });
    return h('article', { class: 'rule-card' }, cv, h('h3', {}, c.title), h('p', {}, c.text),
      h('div', { class: 'chips' }, c.chips.map(([name, note, color]) => h('span', { class: 'rule-chip', style: `--c:${color}` }, h('b', {}, name), ` ${note}`))));
  });
  return {
    el: h('section', { class: 'screen rules' }, h('h2', {}, '룰 설명'), ...cards, btn('돌아가기', onBack, 'primary')),
    draw(t) { for (const { id, g } of canvases) if (g) drawRuleDiagram(g, id, t, mode); },
    count: canvases.length,
  };
}

export function leagueHomeScreen({ state, onPlay, onStats, onBracket, onTitle, onSeasonEnd }) {
  const table = standings(state);
  const nm = nextMatch(state);
  const rival = nm?.opp?.rival ? RIVALS[state.league] : null;
  const header = state.phase === 'tournament' ? '연말 토너먼트' : state.phase === 'seasonEnd' ? '시즌 종료' : `${state.week}주차 / 9`;
  const eff = effectiveStats(state);
  let nextLine;
  if (state.phase === 'seasonEnd') nextLine = '시즌이 끝났습니다.';
  else if (!nm) nextLine = '토너먼트 탈락 — 결과를 기다리는 중';
  else nextLine = [h('strong', {}, state.phase === 'tournament' ? '토너먼트 상대: ' : '다음 경기: '), nm.opp.name, rival ? ` — “${rival.line}”` : ''];
  return h('section', { class: 'screen home' },
    h('header', {}, h('h2', {}, `${LEAGUE_NAMES[state.league]} ${state.season}시즌`), h('span', { class: 'week' }, header)),
    h('table', { class: 'standings' },
      h('thead', {}, h('tr', {}, ['순위', '선수', '승점', '승', '패'].map((t) => h('th', {}, t)))),
      h('tbody', {}, table.map((t) => h('tr', { class: t.me ? 'me' : '' },
        h('td', {}, t.rank), h('td', {}, t.name), h('td', {}, t.points), h('td', {}, t.wins), h('td', {}, t.losses))))),
    h('div', { class: 'next' }, nextLine),
    h('div', { class: 'mystats' },
      Object.entries(STAT_INFO).map(([k, v]) => h('span', { class: 'chip' },
        `${v.label} ${state.stats[k]}${eff[k] !== state.stats[k] ? ` (${eff[k]})` : ''}`)),
      h('span', { class: 'chip pts' }, `포인트 ${state.statPoints}`)),
    state.phase === 'seasonEnd' && btn('시즌 결과 보기', onSeasonEnd, 'primary'),
    nm && btn(state.phase === 'tournament' ? '토너먼트 경기 시작' : '경기 시작', onPlay, 'primary'),
    btn('스탯 투자', onStats),
    btn('토너먼트 대진표', onBracket),
    btn('타이틀', onTitle));
}

/**
 * 시즌 시작 연출: 리그 이름이 떠오른 뒤 이번 시즌 목표가 하나씩 나타나고, 마지막에 라이벌과 시작 버튼.
 * 화면을 탭하면 애니메이션을 건너뛴다(모두 즉시 표시). 동작 줄이기 설정이면 CSS 에서 바로 표시.
 */
export function seasonIntroScreen({ intro, onStart }) {
  const items = intro.goals.map((g, i) => h('li', { class: 'goal', style: `--i:${i}` },
    h('span', { class: 'goal-icon', 'aria-hidden': 'true' }, g.icon), h('div', {}, h('b', {}, g.label), h('span', {}, g.text))));
  const rival = intro.rival && h('p', { class: 'goal-rival', style: `--i:${intro.goals.length}` }, `라이벌 ${intro.rival.name} — “${intro.rival.line}”`);
  const startBtn = h('button', { class: 'btn primary goal-start', type: 'button', style: `--i:${intro.goals.length + 1}`, onclick: (ev) => { ev?.stopPropagation?.(); onStart(); } }, '시즌 시작!');
  const el = h('section', { class: 'screen season-intro', onpointerdown: () => { el.className = 'screen season-intro skip'; } },
    h('div', { class: 'si-title' }, h('small', {}, intro.subtitle), h('h2', {}, intro.title)),
    h('div', { class: 'si-head' }, '이번 시즌 목표'),
    h('ul', { class: 'goals' }, ...items), rival || '', startBtn);
  return { el, skip() { el.className = 'screen season-intro skip'; }, count: items.length };
}

export function equipScreen({ state, onChange, onStart, onBack }) {
  const row = (title, table, owned, current, kind) => [
    h('h3', {}, title),
    ...Object.entries(table).map(([id, it]) => {
      const has = owned.includes(id);
      return h('button', {
        class: `btn equip${current === id ? ' primary' : ''}`, type: 'button', disabled: has ? null : true,
        onclick: () => onChange(kind, id),
      }, has ? `${it.name} — ${it.desc}` : [`${it.name} — 잠김`, h('small', { class: 'unlock' }, `해금 조건: ${unlockCondition(kind, id) ?? '???'}`)]);
    }),
  ];
  const eff = effectiveStats(state);
  return h('section', { class: 'screen equip' },
    h('h2', {}, '경기 전 장비 선택'),
    row('그립', GRIPS, state.unlocked.grips, state.grip, 'grip'),
    row('라켓', RACKETS, state.unlocked.rackets, state.racket, 'racket'),
    h('p', { class: 'mystats' }, `적용 스탯 — 파워 ${eff.power} / 스핀 ${eff.spin} / 집중 ${eff.focus}`),
    btn('경기 시작', onStart, 'primary'),
    btn('돌아가기', onBack));
}

export function seasonResultScreen({ summary, onNext }) {
  const unlockedNames = [
    ...summary.unlocked.grips.map((g) => GRIPS[g].name),
    ...summary.unlocked.rackets.map((r) => RACKETS[r].name),
  ];
  return h('section', { class: 'screen season-result' },
    h('h2', {}, summary.champion ? '리그 챔피언!' : '시즌 종료'),
    h('p', {}, `${LEAGUE_NAMES[summary.league]} 정규 ${summary.rank}위`),
    h('p', {}, `우승자: ${summary.championName}`),
    summary.champion && h('p', { class: 'pts' }, `우승 보너스 +${summary.bonus}pt`),
    summary.promoted && h('p', { class: 'win' }, `${LEAGUE_NAMES[summary.nextLeague]}로 승격!`),
    !summary.champion && h('p', { class: 'quote' }, '지면 다시. 같은 리그에서 다음 시즌!'),
    unlockedNames.length > 0 && h('p', {}, `해금: ${unlockedNames.join(', ')}`),
    btn(summary.ending ? '엔딩 보기' : '다음 시즌', onNext, 'primary'));
}

export function endingScreen({ onNext }) {
  return h('section', { class: 'screen ending' },
    h('h1', { class: 'logo' }, '탁구왕 등극!'),
    h('p', { class: 'sub' }, '지고, 다시 일어서고, 끝내 정상에 올랐다.'),
    h('p', { class: 'quote' }, '“지면 다시.” 그 한마디가 탁구왕을 만들었다.'),
    h('p', {}, '이후에도 무한 시즌으로 계속 도전할 수 있습니다.'),
    btn('계속하기', onNext, 'primary'));
}

export function statsScreen({ state, onInvest, onBack }) {
  return h('section', { class: 'screen stats' },
    h('h2', {}, '스탯 투자'),
    h('p', { class: 'pts' }, `보유 포인트: ${state.statPoints}`),
    Object.entries(STAT_INFO).map(([k, v]) => h('div', { class: 'stat-row' },
      h('div', {}, h('strong', {}, `${v.label} ${state.stats[k]}`), h('small', {}, v.desc)),
      h('button', { class: 'btn', type: 'button', disabled: state.statPoints < 1 ? true : null, onclick: () => onInvest(k) }, '+1'))),
    btn('돌아가기', onBack, 'primary'));
}

export function bracketScreen({ bracket, onBack }) {
  const slot = (m) => h('div', { class: 'match-slot' },
    h('span', { class: m.winner === m.a ? 'win' : '' }, m.a ?? '?'),
    ' vs ',
    h('span', { class: m.winner === m.b ? 'win' : '' }, m.b ?? '?'),
    m.score ? ` (${m.score})` : '');
  return h('section', { class: 'screen bracket' },
    h('h2', {}, '토너먼트 대진표'),
    bracket
      ? [h('h3', {}, '4강'), ...bracket.semis.map(slot), h('h3', {}, '결승'), slot(bracket.final)]
      : h('p', {}, '정규 리그 9경기가 끝나면 상위 4명이 진출합니다.'),
    btn('돌아가기', onBack, 'primary'));
}

export function resultScreen({ result, onNext, reward = null }) {
  return h('section', { class: 'screen result' },
    h('h2', {}, result.won ? '승리!' : result.forfeit ? '기권패' : '패배…'),
    h('p', { class: 'score' }, `${result.score.me} : ${result.score.opp}`),
    h('p', {}, `획득 포인트 +${result.gained}`),
    result.rewarded && h('p', { class: 'win' }, `보상 지급! 포인트 +${result.gained} 추가`),
    !result.won && h('p', { class: 'quote' }, '지면 다시. 한 번 더!'),
    reward && btn(reward.label, reward.onClick),
    btn('계속', onNext, 'primary'));
}

export function matchScreen({ oppName, oppStyle, canvas, onQuit, quitLabel = '포기', onShot = null }) {
  const oppScore = h('span', { class: 'opp-score' }, '0');
  const meScore = h('span', { class: 'me-score' }, '0');
  // 점수판: '나'와 '상대'를 라벨·색으로 구분. 점수를 딴 쪽은 +1 이 튀어 오른다. 서브권은 ● 점
  const oppPlus = h('span', { class: 'plus' }, ''); const mePlus = h('span', { class: 'plus' }, '');
  const oppServe = h('i', { class: 'srv' }, ''); const meServe = h('i', { class: 'srv' }, '');
  const oppPanel = h('div', { class: 'panel opp', 'aria-label': '상대 점수' }, h('div', { class: 'who' }, oppServe, '상대'), oppScore, oppPlus);
  const mePanel = h('div', { class: 'panel me', 'aria-label': '내 점수' }, h('div', { class: 'who' }, meServe, '나'), meScore, mePlus);
  const incoming = h('div', { class: 'incoming', 'aria-live': 'polite' }, '');
  const pbTitle = h('b', {}, ''); const pbDetail = h('span', {}, ''); const pbTip = h('small', {}, '');
  const pointBanner = h('div', { class: 'point-banner', 'aria-live': 'assertive' }, pbTitle, pbDetail, pbTip);
  const judge = h('div', { class: 'judge' }, '');
  const tip = h('div', { class: 'tip', 'aria-live': 'polite' }, '');
  const coachHead = h('div', { class: 'coach-head' }, ''); const coachText = h('div', { class: 'coach-text' }, '');
  const coachGoals = h('div', { class: 'coach-goals' }, ''); const coachFb = h('div', { class: 'coach-feedback' }, '');
  const coachCv = h('canvas', { class: 'coach-diagram', width: DIAGRAM_W, height: DIAGRAM_H, 'aria-hidden': 'true' }); coachCv.width = DIAGRAM_W; coachCv.height = DIAGRAM_H;
  const coachG = coachCv.getContext?.('2d'); if (coachG) coachG.imageSmoothingEnabled = false;
  let coachDiagram = null;
  const coach = h('div', { class: 'coach', 'aria-live': 'polite' }, coachHead, h('div', { class: 'coach-body' }, coachCv, h('div', { class: 'coach-main' }, coachText, coachGoals, coachFb)));
  // 샷 선택 바(간단 조작): 공이 오기 전에 미리 고르는 큰 버튼. 마지막 선택이 유지된다
  const shotBtns = {};
  const bar = h('div', { class: 'shotbar', role: 'group', 'aria-label': '샷 종류 선택' },
    SHOT_ORDER.map((k) => {
      const t = SHOT_TYPES[k];
      shotBtns[k] = h('button', { class: 'shot-btn', type: 'button', 'data-shot': k, style: `--c:${t.color}`, onclick: () => onShot?.(k) },
        h('b', {}, t.label), h('em', {}, t.tag), h('small', {}, t.desc));
      return shotBtns[k];
    }));
  const badge = h('div', { class: 'serve-badge' }, '');
  const banner = h('div', { class: 'serve-banner', 'aria-live': 'polite' }, '');
  let flashes = 0; let pops = 0; let banners = 0;
  return {
    // 캔버스를 화면 폭 가득 쓰고, 점수·상대 정보·판정·포기는 캔버스 위 오버레이, 힌트는 캔버스 아래
    el: h('section', { class: 'screen match' },
      h('div', { class: 'match-stage' },
        canvas,
        h('div', { class: 'hud' },
          h('div', { class: 'opp-info' }, `${oppName}`, h('small', {}, oppStyle)),
          h('div', { class: 'scoreboard' }, oppPanel, h('span', { class: 'vs' }, ':'), mePanel),
          badge, judge, incoming),
        banner, pointBanner,
        h('button', { class: 'btn quit', type: 'button', onclick: onQuit }, quitLabel)),
      bar, coach, tip),
    setTip(text) { tip.textContent = text; tip.className = text ? 'tip on' : 'tip'; },
    /** 샷 선택 바: 간단 조작에서만 보인다 */
    setShotBar(visible) { bar.className = visible ? 'shotbar on' : 'shotbar'; },
    setShot(key) { for (const [k, el] of Object.entries(shotBtns)) el.className = `shot-btn${k === key ? ' sel' : ''}${el.className.includes('hint') ? ' hint' : ''}`; },
    /** 튜토리얼: 눌러야 할 버튼을 반짝이게 */
    setShotHint(key) { for (const [k, el] of Object.entries(shotBtns)) { const sel = el.className.includes('sel'); el.className = `shot-btn${sel ? ' sel' : ''}${k === key ? ' hint' : ''}`; } },
    /** 튜토리얼 설명 그림(룰 설명과 같은 도트 다이어그램). id 가 없으면 그림 칸을 숨긴다 */
    setCoachDiagram(id) { coachDiagram = id; coachCv.className = id ? 'coach-diagram on' : 'coach-diagram'; },
    drawCoachDiagram(t, mode) { if (coachDiagram && coachG) drawRuleDiagram(coachG, coachDiagram, t, mode); },
    get coachDiagram() { return coachDiagram; },
    /** 튜토리얼 코치 패널: v = tutorial.view (null 이면 숨김) */
    setCoach(v) {
      if (!v) { coach.className = 'coach'; return; }
      coach.className = v.completed ? 'coach on done' : 'coach on';
      coachHead.textContent = v.completed ? '튜토리얼 완료!' : `STEP ${v.index + 1}/${v.total} · ${v.title}`;
      coachText.textContent = v.completed ? '모든 조작을 익혔어요. 잠시 뒤 다음 화면으로 갑니다.' : v.text;
      coachGoals.textContent = v.goals.map((g) => `${g.label} ${g.got}/${g.need}`).join('   ');
      coachFb.textContent = v.feedback;
    },
    /** 항상 보이는 서브 배지: 지금 서브 차례가 누구인지 */
    setServe(side) {
      badge.textContent = side === 'me' ? '내 서브' : side === 'opp' ? '상대 서브' : '';
      badge.className = `serve-badge ${side ?? ''}`.trim();
    },
    /** 서브 차례가 시작될 때 크게 알림 (두 애니메이션을 번갈아 써서 연속으로도 다시 재생된다) */
    flashServe(side) {
      flashes += 1;
      banner.textContent = side === 'me' ? '내 서브!  화면을 탭하세요' : '상대 서브';
      banner.className = `serve-banner show ${side} f${flashes % 2}`;
    },
    setScore(me, opp, server) {
      meScore.textContent = String(me); oppScore.textContent = String(opp);
      meServe.textContent = server === 'me' ? '●' : ''; oppServe.textContent = server === 'opp' ? '●' : '';
    },
    /** 점수를 딴 쪽 패널을 강조하고 +1 을 띄운다 (두 클래스를 번갈아 써서 연속 득점도 다시 재생) */
    flashScore(side) {
      pops += 1; const [on, off, plus, other] = side === 'me' ? [mePanel, oppPanel, mePlus, oppPlus] : [oppPanel, mePanel, oppPlus, mePlus];
      on.className = `panel ${side} scored p${pops % 2}`; off.className = `panel ${side === 'me' ? 'opp' : 'me'}`;
      plus.textContent = '+1'; other.textContent = '';
    },
    /** 득점/실점 배너: p = describePoint 결과 {tone,title,detail,tip} (null 이면 숨김) */
    setPoint(p) {
      if (!p) { pointBanner.className = 'point-banner'; pbTitle.textContent = ''; pbDetail.textContent = ''; pbTip.textContent = ''; return; }
      banners += 1;
      pbTitle.textContent = p.title; pbDetail.textContent = p.detail; pbTip.textContent = p.tip ?? '';
      pointBanner.className = `point-banner show ${p.tone} b${banners % 2}`;
    },
    /** 날아오는 상대 공 종류 칩 (간단 조작). text 가 비면 숨김. key: 색 */
    setIncoming(text, key = null) { incoming.textContent = text; incoming.className = text ? `incoming on ${key ?? ''}`.trim() : 'incoming'; },
    setJudge(text) { judge.textContent = text; },
  };
}

export function tutorialDoneScreen({ onPlay, onAgain, onTitle, hasSave }) {
  return h('section', { class: 'screen tutorial-done' },
    h('h2', {}, '튜토리얼 완료!'),
    h('p', { class: 'quote' }, '탭 타이밍 · 코스 · 탑스핀/커트 · 파워까지 모두 익혔어요.'),
    h('ul', {},
      h('li', {}, '노란 띠 안에서 탭, 붉은 띠 한가운데는 PERFECT'),
      h('li', {}, '탭 위치 = 코스 (왼쪽 · 가운데 · 오른쪽)'),
      h('li', {}, '위로 쓸기 = 탑스핀, 아래로 쓸기 = 커트'),
      h('li', {}, '길게 쓸수록 강한 샷 (너무 세면 아웃)')),
    btn(hasSave ? '내 시즌으로 가기' : '새로 시작하기', onPlay, 'primary'),
    btn('튜토리얼 다시 하기', onAgain),
    btn('타이틀', onTitle));
}
