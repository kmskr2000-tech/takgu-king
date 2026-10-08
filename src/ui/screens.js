import { h } from './dom.js?v=1791434034';
import { ICON_PADDLE, ICON_PALETTE, drawSprite } from './sprites.js?v=1791434034';
import { drawLogo, LOGO_W, LOGO_H, LOGO_TEXT } from './logo.js?v=1791434034';
import { drawTitleBackground, TB_W, TB_H } from './titlebg.js?v=1791434034';
import { SHOT_TYPES, SHOT_ORDER } from '../game/controls.js?v=1791434034';
import { drawRuleDiagram, ruleCards, DIAGRAM_W, DIAGRAM_H } from './rules.js?v=1791434034';
import { PROTAGONIST, CATCHPHRASE } from '../game/story.js?v=1791434034';
import {
  LEAGUE_NAMES, RIVALS, standings, nextMatch, GRIPS, RACKETS, effectiveStats, unlockCondition,
} from '../game/season.js?v=1791434034';
import { statCurve, statEfficiency } from '../game/statcurve.js?v=1791434034';

const STAT_INFO = {
  power: { label: '파워', desc: '스매시 위력↑, 상대 리턴 난이도↑' },
  spin: { label: '스핀', desc: '회전량↑, 스핀 샷 효과↑' },
  focus: { label: '집중', desc: '타이밍 판정 구간↑, 실수율↓' },
};

/** 적용 스탯(곡선 적용 후)은 소수가 될 수 있다: 정수면 그대로, 아니면 소수 한 자리 */
const fmt = (v) => String(Math.round(v * 10) / 10);

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

/** 도민구 소개 컷신 화면: 탭 = 다음 줄, 건너뛰기 = 전부 넘김. who: 말하는 사람 표시(오순자 등), kind: n 나레이션 / m 독백 / s 대사 */
export function storyIntroScreen({ canvas, onAdvance, onSkip }) {
  const who = h('div', { class: 'intro-who' }, '');
  const caption = h('div', { class: 'intro-caption', 'aria-live': 'polite' }, '');
  const skip = h('button', { class: 'intro-skip', type: 'button', onpointerdown: (ev) => ev?.stopPropagation?.(), onclick: (ev) => { ev?.stopPropagation?.(); onSkip(); } }, '건너뛰기 ▶'); // 건너뛰기 누를 때 '다음 줄' 탭으로 번지지 않게
  const el = h('section', { class: 'screen intro story-intro', onpointerdown: onAdvance },
    h('div', { class: 'intro-stage' }, canvas), who, caption, skip,
    h('div', { class: 'intro-hint' }, '화면을 탭하면 다음 장면'));
  return {
    el,
    setCaption(c) {
      caption.textContent = c ? (c.kind === 'm' || c.kind === 's' ? `“${c.text}”` : c.text) : '';
      caption.className = `intro-caption ${c?.kind ?? ''}`.trim();
      who.textContent = c ? (c.kind === 'm' ? '도민구' : c.who ?? '') : '';
    },
  };
}

export function titleScreen({ hasSave, onContinue, onNew, onTutorial = null, onMulti = null, onSettings, onRules, level = null, onLevel = null }) {
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
    onMulti && btn('멀티플레이', onMulti),
    // 게임 난이도(보통/어려움/매우 어려움): 누를 때마다 다음 단계. 상대 AI 배율(리그 난이도에 곱)
    level && onLevel && h('button', { class: 'btn level', type: 'button', 'aria-label': `게임 난이도 ${level.label}`, onclick: onLevel },
      h('span', { class: 'sname' }, '게임 난이도'), h('span', { class: 'sstate' }, `${level.label} ▸`)),
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
  else nextLine = [h('strong', {}, state.phase === 'tournament' ? '토너먼트 상대: ' : '다음 경기: '), nm.opp.name, rival ? ` (${rival.nickname}) — “${rival.line}”` : ''];
  return h('section', { class: 'screen home' },
    h('header', {}, h('h2', {}, `${LEAGUE_NAMES[state.league]} ${state.season}시즌`), h('span', { class: 'week' }, header)),
    h('table', { class: 'standings' },
      h('thead', {}, h('tr', {}, ['순위', '선수', '승점', '승', '패'].map((t) => h('th', {}, t)))),
      h('tbody', {}, table.map((t) => h('tr', { class: t.me ? 'me' : '' },
        h('td', {}, t.rank), h('td', {}, t.name), h('td', {}, t.points), h('td', {}, t.wins), h('td', {}, t.losses))))),
    h('div', { class: 'next' }, nextLine),
    h('div', { class: 'mystats' },
      Object.entries(STAT_INFO).map(([k, v]) => h('span', { class: 'chip' },
        `${v.label} ${state.stats[k]}${fmt(eff[k]) !== String(state.stats[k]) ? ` (${fmt(eff[k])})` : ''}`)),
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
export function seasonIntroScreen({ intro, onStart, story = null }) {
  const items = intro.goals.map((g, i) => h('li', { class: 'goal', style: `--i:${i}` },
    h('span', { class: 'goal-icon', 'aria-hidden': 'true' }, g.icon), h('div', {}, h('b', {}, g.label), h('span', {}, g.text))));
  const rival = intro.rival && h('p', { class: 'goal-rival', style: `--i:${intro.goals.length}` }, `라이벌 ${intro.rival.name}${intro.rival.nickname ? ` (${intro.rival.nickname})` : ''} — ${intro.rival.line}`);
  const storyEl = story && h('div', { class: 'si-story', style: '--i:0' }, h('small', {}, `${story.leagueTitle} · ${story.label}`), h('b', {}, story.title), ...story.text.split('\n').map((t) => h('p', {}, t)));
  const startBtn = h('button', { class: 'btn primary goal-start', type: 'button', style: `--i:${intro.goals.length + 1}`, onclick: (ev) => { ev?.stopPropagation?.(); onStart(); } }, '시즌 시작!');
  const el = h('section', { class: 'screen season-intro', onpointerdown: () => { el.className = 'screen season-intro skip'; } },
    h('div', { class: 'si-title' }, h('small', {}, intro.subtitle), h('h2', {}, intro.title)),
    storyEl || '',
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
    h('p', { class: 'mystats' }, `적용 스탯 — 파워 ${fmt(eff.power)} / 스핀 ${fmt(eff.spin)} / 집중 ${fmt(eff.focus)}`),
    btn('경기 시작', onStart, 'primary'),
    btn('돌아가기', onBack));
}

export function seasonResultScreen({ summary, onNext, story = null }) {
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
    story && h('div', { class: 'story-beat' }, h('b', {}, story.title), ...story.text.split('\n').map((t) => h('p', {}, t))),
    !summary.champion && h('p', { class: 'quote' }, `“${CATCHPHRASE}” — ${PROTAGONIST.name}. 같은 리그에서 다음 시즌!`),
    unlockedNames.length > 0 && h('p', {}, `해금: ${unlockedNames.join(', ')}`),
    btn(summary.ending ? '엔딩 보기' : '다음 시즌', onNext, 'primary'));
}

export function endingScreen({ onNext, story = null }) {
  return h('section', { class: 'screen ending' },
    h('h1', { class: 'logo' }, '탁구왕 등극!'),
    h('p', { class: 'sub' }, '지고, 다시 일어서고, 끝내 정상에 올랐다.'),
    story && h('div', { class: 'story-beat' }, ...story.text.split('\n').map((t) => h('p', {}, t))),
    h('p', { class: 'quote' }, '“지면 다시.” 그 한마디가 탁구왕을 만들었다.'),
    h('p', {}, '이후에도 무한 시즌으로 계속 도전할 수 있습니다.'),
    btn('계속하기', onNext, 'primary'));
}

export function statsScreen({ state, onInvest, onBack }) {
  return h('section', { class: 'screen stats' },
    h('h2', {}, '스탯 투자'),
    h('p', { class: 'pts' }, `보유 포인트: ${state.statPoints}`),
    Object.entries(STAT_INFO).map(([k, v]) => h('div', { class: 'stat-row' },
      h('div', {}, h('strong', {}, `${v.label} ${state.stats[k]}`), h('small', {}, v.desc),
        h('small', { class: 'eff' }, `적용 ${fmt(statCurve(state.stats[k]))} · +1 효율 ${Math.round(statEfficiency(state.stats[k]) * 100)}%`)),
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
    result.story && storyBubbles(result.story.lines), // 라이벌전: 상대의 승리/패배 대사 (진 경우 주인공의 "…다시." 까지)
    !result.won && !result.story && h('p', { class: 'quote' }, `“${CATCHPHRASE}” — ${PROTAGONIST.name}`), // 그 밖의 패배: 주인공의 입버릇
    reward && btn(reward.label, reward.onClick),
    btn('계속', onNext, 'primary'));
}

export function matchScreen({ oppName, oppStyle = '', oppTags = null, canvas, onQuit, quitLabel = '포기', onSwing = null, ticker = false }) {
  const oppScore = h('span', { class: 'opp-score' }, '0');
  const meScore = h('span', { class: 'me-score' }, '0');
  // 점수판: '나'와 '상대'를 라벨·색으로 구분. 점수를 딴 쪽은 +1 이 튀어 오른다. 서브권은 ● 점
  const oppPlus = h('span', { class: 'plus' }, ''); const mePlus = h('span', { class: 'plus' }, '');
  const oppServe = h('i', { class: 'srv' }, ''); const meServe = h('i', { class: 'srv' }, '');
  const oppPanel = h('div', { class: 'panel opp', 'aria-label': '상대 점수' }, h('div', { class: 'who' }, oppServe, '상대'), oppScore, oppPlus);
  const mePanel = h('div', { class: 'panel me', 'aria-label': '내 점수' }, h('div', { class: 'who' }, meServe, '나'), meScore, mePlus);
  const incoming = h('div', { class: 'incoming', 'aria-live': 'polite' }, '');
  const laneChip = h('div', { class: 'lane-chip' }, '');
  // 상성 안내(작게, 코트 아래 모서리): 탑스핀 > 커트 > 일반 > 탑스핀. 색은 공/버튼 색과 같다
  const rps = h('div', { class: 'rps', 'aria-label': '상성: 탑스핀은 커트에, 커트는 일반에, 일반은 탑스핀에 강함' },
    ...[['topspin', SHOT_TYPES.topspin], ['cut', SHOT_TYPES.cut], ['normal', SHOT_TYPES.normal], ['topspin', SHOT_TYPES.topspin]].flatMap(([k, t], i) => [
      i > 0 && h('i', { class: 'arrow' }, '›'), h('b', { class: `k ${k}`, style: `color:${t.color}` }, t.label)]));
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
      // 버튼을 누르는 순간(pointerdown)이 곧 스윙: onclick 은 손을 뗄 때(80~150ms 뒤)라 PERFECT 가 거의 불가능해진다.
      // 키보드(Enter/Space)로 누른 click(detail 0)만 별도로 받는다. 터치 뒤의 click 은 무시.
      shotBtns[k] = h('button', {
        class: 'shot-btn', type: 'button', 'data-shot': k, style: `--c:${t.color}`,
        onpointerdown: (ev) => { ev?.preventDefault?.(); onSwing?.(k); },
        onclick: (ev) => { if (ev?.detail === 0) onSwing?.(k); },
      },
        h('b', {}, t.label), h('em', {}, t.tag), h('small', {}, t.desc));
      return shotBtns[k];
    }));
  // 첫 경기 안내 오버레이: 화면 전체를 덮어 아래(코트·샷 버튼)로 터치가 새지 않는다. '다음'(click)으로만 넘어간다
  const gTitle = h('b', { class: 'g-title' }, ''); const gStep = h('small', { class: 'g-step' }, ''); const gText = h('p', { class: 'g-text' }, '');
  let guideNext = null; let guideSkip = null;
  const gNext = h('button', { class: 'btn primary g-next', type: 'button', onclick: () => guideNext?.() }, '다음');
  const gSkip = h('button', { class: 'btn g-skip', type: 'button', onclick: () => guideSkip?.() }, '안내 건너뛰기');
  const guide = h('div', { class: 'guide', role: 'dialog', 'aria-live': 'assertive' }, h('div', { class: 'guide-card' }, gStep, gTitle, gText, gNext, gSkip));
  // 리그전 속보 한 줄: 같은 라운드 다른 경기 스코어가 '오순자 2-1 김탁구' 식으로 흘러간다. 득점하면 그 경기로 넘어가 득점한 쪽이 반짝
  const tkA = h('b', { class: 'tk-a' }, ''); const tkS = h('em', { class: 'tk-sc' }, ''); const tkB = h('b', { class: 'tk-b' }, '');
  const tkTag = h('small', { class: 'tk-tag' }, ''); const tkIdx = h('small', { class: 'tk-idx' }, '');
  const tickerEl = ticker ? h('div', { class: 'ticker', role: 'status', 'aria-label': '리그 다른 경기 속보' }, h('span', { class: 'tk-live' }, '속보'), h('span', { class: 'tk-line' }, tkA, tkS, tkB), tkTag, tkIdx) : null;
  let tkN = 0;
  const badge = h('div', { class: 'serve-badge' }, '');
  const banner = h('div', { class: 'serve-banner', 'aria-live': 'polite' }, '');
  let flashes = 0; let pops = 0; let banners = 0; let presses = 0; let judgeN = 0;
  return {
    // 캔버스를 화면 폭 가득 쓰고, 점수·상대 정보·판정·포기는 캔버스 위 오버레이, 힌트는 캔버스 아래
    el: h('section', { class: 'screen match' },
      h('div', { class: 'match-stage' },
        canvas,
        h('div', { class: 'hud' },
          // 윗줄: [빈칸 | 상대 이름·칩 | 포기]. 포기 버튼을 흐름 안에 둬서 점수판·칩과 겹치지 않는다
          h('div', { class: 'hud-top' },
            h('span', { class: 'hud-side', 'aria-hidden': 'true' }),
            h('div', { class: 'opp-info' }, h('b', { class: 'opp-name' }, oppName),
              // 특징 칩: 라이벌 / 플레이 스타일(커트 위주·올라운더) / 실력대. (oppTags 없으면 예전처럼 한 줄 설명)
              h('div', { class: 'opp-tags' }, ...(oppTags ?? (oppStyle ? [{ label: oppStyle, kind: 'all' }] : [])).map((t) => h('span', { class: `opp-tag ${t.kind}` }, t.label)))),
            h('button', { class: 'btn quit', type: 'button', onclick: onQuit }, quitLabel)),
          h('div', { class: 'scoreboard' }, oppPanel, h('span', { class: 'vs' }, ':'), mePanel),
          // 판정·공 종류·코스 라벨은 고정 px 가 아니라 점수판 아래로 흐른다 (이름·칩이 두 줄이 돼도 안 겹침)
          h('div', { class: 'hud-sub' }, badge, judge, incoming, laneChip)),
        banner, pointBanner, rps,
        // 힌트는 캔버스 아래 칸이 아니라 캔버스 위에 겹쳐 표시 (비어 있어도 자리를 차지하던 빈 줄 제거)
        tip),
      tickerEl, bar, coach, guide),
    /** 속보 한 줄 갱신: v = { aName, bName, sa, sb, done, flash('a'|'b'|null), index, total } */
    setTicker(v) {
      if (!tickerEl || !v) return;
      tkN += 1;
      tkA.textContent = v.aName; tkB.textContent = v.bName; tkS.textContent = `${v.sa}-${v.sb}`;
      tkA.className = `tk-a${v.flash === 'a' ? ` hot h${tkN % 2}` : ''}`; tkB.className = `tk-b${v.flash === 'b' ? ` hot h${tkN % 2}` : ''}`;
      tkTag.textContent = v.done ? '종료' : v.flash ? '득점!' : ''; tkIdx.textContent = `${v.index}/${v.total}`;
      tickerEl.className = `ticker${v.done ? ' done' : ''}${v.flash && !v.done ? ' goal' : ''}`;
    },
    /** 첫 경기 안내 한 페이지: { step: '1/3', title, text, last, onNext, onSkip }. 멈춘 동안 화면을 덮는다 */
    showGuide({ step, title, text, last = false, onNext, onSkip }) {
      gStep.textContent = step; gTitle.textContent = title; gText.textContent = text; gNext.textContent = last ? '시작!' : '다음';
      guideNext = onNext; guideSkip = onSkip; guide.className = 'guide on';
    },
    hideGuide() { guide.className = 'guide'; guideNext = null; guideSkip = null; },
    get guideOpen() { return guide.className.includes('on'); },
    setTip(text) { tip.textContent = text; tip.className = text ? 'tip on' : 'tip'; },
    /** 샷 선택 바: 간단 조작에서만 보인다 */
    setShotBar(visible) { bar.className = visible ? 'shotbar on' : 'shotbar'; },
    /** 누른 버튼 잠깐 반짝 (선택 상태는 남기지 않는다: 샷 종류는 매번 상대 공을 보고 새로 정한다) */
    flashShot(key) { presses += 1; for (const [k, el] of Object.entries(shotBtns)) el.className = `shot-btn${el.className.includes('hint') ? ' hint' : ''}${k === key ? ` press p${presses % 2}` : ''}`; },
    /** 튜토리얼: 눌러야 할 버튼을 반짝이게 */
    setShotHint(key) { for (const [k, el] of Object.entries(shotBtns)) { const press = el.className.match(/ press p[01]/)?.[0] ?? ''; el.className = `shot-btn${press}${k === key ? ' hint' : ''}`; } },
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
    flashServe(side, mode = 'simple') {
      flashes += 1;
      banner.textContent = side === 'me' ? (mode === 'simple' ? '내 서브!  샷 버튼을 눌러요' : '내 서브!  화면을 탭하세요') : '상대 서브';
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
    /** 코스 마커 라벨 (간단 조작): lane 이 null 이면 숨김. 코트를 탭하면 바뀌고, 버튼 스윙이 이 코스로 나간다 */
    setLane(lane) { laneChip.textContent = ''; laneChip.className = lane ? `lane-chip ${lane}` : 'lane-chip'; }, // '코스: …' 문구는 튜토리얼로 배우므로 표시하지 않는다
    /** 상성 안내 표시 여부 (간단 조작·본 경기에서만) */
    setRps(visible) { rps.className = visible ? 'rps on' : 'rps'; },
    setIncoming(text, key = null) { incoming.textContent = text; incoming.className = text ? `incoming on ${key ?? ''}`.trim() : 'incoming'; },
    /** 판정 문구. kind(perfect/good/bad/miss)별 색, perfect 는 크게 튀어 오른다 (두 클래스를 번갈아 써서 연속으로도 재생) */
    setJudge(text, kind = '') { judgeN += 1; judge.textContent = text; judge.className = text && kind ? `judge ${kind} j${judgeN % 2}` : 'judge'; },
  };
}

export function tutorialDoneScreen({ onPlay, onAgain, onTitle, hasSave, mode }) {
  const simple = mode !== 'advanced';
  return h('section', { class: 'screen tutorial-done' },
    h('h2', {}, '튜토리얼 완료!'),
    h('p', { class: 'quote' }, simple ? '타이밍 · 코스 · 샷 고르기 · 상성까지 모두 익혔어요.' : '탭 타이밍 · 코스 · 탑스핀/커트 · 파워까지 모두 익혔어요.'),
    h('ul', {}, ...(simple ? [
      '띠 안에서 샷 버튼, 띠 한가운데의 밝은 줄은 PERFECT',
      '코트 탭 = 코스 (왼쪽 · 가운데 · 오른쪽), 샷 버튼을 누르는 순간 = 스윙',
      '상대 공을 보고 고르기: 탑스핀 > 커트 > 일반 > 탑스핀',
    ] : [
      '노란 띠 안에서 탭, 붉은 띠 한가운데는 PERFECT',
      '탭 위치 = 코스 (왼쪽 · 가운데 · 오른쪽)',
      '위로 쓸기 = 탑스핀, 아래로 쓸기 = 커트',
      '길게 쓸수록 강한 샷 (너무 세면 아웃)',
    ]).map((t) => h('li', {}, t))),
    btn(hasSave ? '내 시즌으로 가기' : '새로 시작하기', onPlay, 'primary'),
    btn('튜토리얼 다시 하기', onAgain),
    btn('타이틀', onTitle));
}

/** 말풍선 목록: [{who, text}] — 주인공은 오른쪽(노랑), 그 밖의 인물은 왼쪽 */
function storyBubbles(lines) {
  return h('div', { class: 'bubbles' }, lines.map((l, i) => h('div', { class: `bubble${l.who === PROTAGONIST.name ? ' me' : ''}`, style: `--i:${i}` }, h('b', {}, l.who), h('p', {}, `“${l.text}”`))));
}

/** 라이벌전 직전 컷: 라이벌 소개(이름·별명·나이·한 줄 설명) + 대사. 시작 버튼으로 경기 화면으로 */
export function rivalCardScreen({ rival, lines, first, onStart }) {
  return h('section', { class: 'screen rival-card' },
    h('small', { class: 'rc-tag' }, first ? '라이벌 첫 등장' : '라이벌전'),
    h('h2', {}, rival.name),
    h('p', { class: 'rc-nick' }, `“${rival.nickname}” · ${rival.age}세`),
    h('p', { class: 'rc-role' }, rival.role),
    h('p', { class: 'rc-blurb' }, rival.blurb),
    storyBubbles(lines),
    btn('경기 시작', onStart, 'primary'));
}

/** 시즌 중 스토리 컷(연패·중반·관계·결승): 한 장 */
export function storyBeatScreen({ beat, onNext }) {
  return h('section', { class: 'screen story-beat-screen' },
    h('small', { class: 'sb-tag' }, `${beat.leagueTitle} · ${beat.label}`),
    h('h2', {}, beat.title),
    ...beat.text.split('\n').map((t) => h('p', { class: 'sb-text' }, t)),
    beat.quote && h('p', { class: 'quote' }, `“${beat.quote}” — ${PROTAGONIST.name}`),
    btn('계속', onNext, 'primary'));
}

/**
 * 멀티플레이 로비. mode: 'menu'(방 만들기 / 로비 목록) · 'hosting'(내 방 제목을 보여주고 기다림) · 'joining'(연결 중) · 'syncing'(시계 맞추는 중)
 * 화면은 한 번 만들고 setMode 로 바꾼다 (입력 중인 닉네임·제목이 사라지지 않게).
 */
export function multiScreen({ onHost, onPick = () => {}, onRefresh = () => {}, onCancel, onBack, nick = '' }) {
  const status = h('p', { class: 'net-status', 'aria-live': 'polite' }, '');
  const nickInput = h('input', { class: 'nick-input', type: 'text', maxlength: '12', placeholder: '닉네임', autocomplete: 'off', spellcheck: 'false', 'aria-label': '닉네임', value: nick });
  const titleInput = h('input', { class: 'title-input', type: 'text', maxlength: '20', placeholder: '방 제목 (예: 금요일 탁구)', autocomplete: 'off', spellcheck: 'false', 'aria-label': '방 제목' });
  const roomList = h('div', { class: 'room-list', 'aria-live': 'polite' });
  const getNick = () => String(nickInput.value ?? '').trim();
  const menu = h('div', { class: 'net-menu' },
    h('div', { class: 'nick-row' }, h('span', {}, '내 닉네임'), nickInput),
    h('div', { class: 'join-row' }, titleInput, btn('방 만들기', () => onHost(String(titleInput.value ?? '').trim(), getNick()), 'primary')),
    h('div', { class: 'room-head' }, h('span', {}, '열린 방'), btn('새로고침', onRefresh)),
    roomList);
  const roomName = h('div', { class: 'room-name', 'aria-label': '내 방' }, '');
  const waiting = h('div', { class: 'net-wait' }, h('p', { class: 'hint' }, '친구가 목록에서 이 방을 누르면 시작해요'), roomName, btn('취소', onCancel));
  const busy = h('div', { class: 'net-busy' }, btn('취소', onCancel));
  const el = h('section', { class: 'screen multi' },
    h('h2', {}, '멀티플레이'),
    h('p', { class: 'quote' }, '친구와 실시간 1:1 대전. 한 명이 제목을 정해 방을 만들고, 다른 한 명이 목록에서 방을 눌러 들어와요.'),
    status, menu, waiting, busy, btn('뒤로', onBack));
  const show = (node, on) => { node.className = `${node.className.replace(/\s*\bhidden\b/g, '')}${on ? '' : ' hidden'}`; };
  let mode = 'menu';
  const api = {
    el, nickInput, titleInput, getNick,
    /** rooms: [{code,title,host}] 또는 null(불러오는 중) */
    setRooms(rooms, failed = false) {
      roomList.textContent = '';
      if (failed) { roomList.appendChild(h('p', { class: 'hint err' }, '방 목록을 불러오지 못했어요. 새로고침을 눌러 주세요.')); return; }
      if (rooms == null) { roomList.appendChild(h('p', { class: 'hint' }, '방 목록 불러오는 중…')); return; }
      if (!rooms.length) { roomList.appendChild(h('p', { class: 'hint' }, '열린 방이 없어요. 방을 만들어 보세요!')); return; }
      for (const r of rooms) roomList.appendChild(h('button', { class: 'room-item', type: 'button', onclick: () => onPick(r.code, getNick()) }, h('span', { class: 'room-title' }, r.title, h('small', { class: 'room-host' }, ` · ${r.host ?? '방장'}`)), h('span', { class: 'room-go' }, '입장')));
    },
    get mode() { return mode; },
    setMode(m, { title = '', message = '' } = {}) {
      mode = m;
      show(menu, m === 'menu'); show(waiting, m === 'hosting'); show(busy, m === 'joining' || m === 'syncing');
      roomName.textContent = title;
      status.textContent = message || (m === 'hosting' ? '상대를 기다리는 중…' : m === 'joining' ? '방에 연결하는 중…' : m === 'syncing' ? '시계를 맞추는 중…' : '');
      status.className = `net-status${message && m === 'menu' ? ' err' : ''}`;
    },
  };
  api.setMode('menu');
  return api;
}

/** 멀티플레이 결과. status: ''(대기) | 'wait'(내가 한 번 더 눌렀다) | 'asked'(상대가 한 번 더 하자고 한다) | 'gone'(상대가 나갔다) */
export function netResultScreen({ won, score, peerName, onAgain, onExit }) {
  const again = btn('한 번 더', onAgain, 'primary'); const note = h('p', { class: 'net-status', 'aria-live': 'polite' }, '');
  const el = h('section', { class: 'screen result net-result' },
    h('h2', {}, won ? '승리!' : '패배…'),
    h('p', { class: 'score' }, `${score.me} : ${score.opp}`),
    h('p', {}, `상대: ${peerName || '상대'}`), note, again, btn('나가기', onExit));
  return {
    el,
    setStatus(status) {
      note.textContent = status === 'wait' ? '상대가 수락하길 기다리는 중…' : status === 'asked' ? '상대가 한 번 더 하자고 해요!' : status === 'gone' ? '상대가 나갔어요.' : '';
      if (status === 'gone' || status === 'wait') again.setAttribute('disabled', ''); else again.removeAttribute?.('disabled');
    },
  };
}
