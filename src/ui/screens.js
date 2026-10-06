import { h } from './dom.js?v=1791275435';
import { ICON_PADDLE, ICON_PALETTE, drawSprite } from './sprites.js?v=1791275435';
import { drawLogo, LOGO_W, LOGO_H, LOGO_TEXT } from './logo.js?v=1791275435';
import { drawTitleBackground, TB_W, TB_H } from './titlebg.js?v=1791275435';
import {
  LEAGUE_NAMES, RIVALS, standings, nextMatch, GRIPS, RACKETS, effectiveStats,
} from '../game/season.js?v=1791275435';

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

export function titleScreen({ hasSave, onContinue, onNew, onSettings, onRules }) {
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
    btn('설정', onSettings),
    btn('룰 설명', onRules));
}

export function settingsScreen({ defs, values, onToggle, onReset, onBack }) {
  return h('section', { class: 'screen settings' },
    h('h2', {}, '설정'),
    defs.map((d) => h('button', {
      class: `btn setting${values[d.key] ? ' on' : ''}`, type: 'button', 'aria-pressed': values[d.key] ? 'true' : 'false',
      onclick: () => onToggle(d.key),
    }, h('span', { class: 'sname' }, d.label), h('span', { class: 'sstate' }, values[d.key] ? '켜짐' : '꺼짐'), h('small', {}, d.desc))),
    btn('저장 데이터 삭제', onReset, 'danger'),
    btn('돌아가기', onBack, 'primary'));
}

export function rulesScreen({ onBack }) {
  return h('section', { class: 'screen rules' },
    h('h2', {}, '룰 설명'),
    h('ul', {},
      h('li', {}, '공이 내 코트에 떨어지면 타이밍 존이 열립니다. 존 중앙에 맞춰 탭!'),
      h('li', {}, '중앙은 PERFECT, 양옆은 GOOD, 존 밖 탭이나 노탭은 MISS(실점).'),
      h('li', {}, '탭 위치(좌/중앙/우)로 코스를 정합니다.'),
      h('li', {}, '위로 드래그: 탑스핀 / 아래로 드래그: 커트 / 드래그 길이: 파워.'),
      h('li', {}, '파워가 너무 세면 아웃, 너무 낮고 평평하면 네트에 걸립니다.'),
      h('li', {}, '11점 선취(10:10부터 2점 차), 2점마다 서브 교대.'),
      h('li', {}, '승리 3pt, 패배 1pt. 파워/스핀/집중에 투자하세요.')),
    btn('돌아가기', onBack, 'primary'));
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
      h('thead', {}, h('tr', {}, ['순위', '팀', '승점', '승', '패'].map((t) => h('th', {}, t)))),
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

export function equipScreen({ state, onChange, onStart, onBack }) {
  const row = (title, table, owned, current, kind) => [
    h('h3', {}, title),
    ...Object.entries(table).map(([id, it]) => {
      const has = owned.includes(id);
      return h('button', {
        class: `btn equip${current === id ? ' primary' : ''}`, type: 'button', disabled: has ? null : true,
        onclick: () => onChange(kind, id),
      }, `${it.name} — ${has ? it.desc : '잠김'}`);
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
    h('p', {}, `우승팀: ${summary.championName}`),
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
      : h('p', {}, '정규 리그 9경기가 끝나면 상위 4팀이 진출합니다.'),
    btn('돌아가기', onBack, 'primary'));
}

export function resultScreen({ result, onNext }) {
  return h('section', { class: 'screen result' },
    h('h2', {}, result.won ? '승리!' : result.forfeit ? '기권패' : '패배…'),
    h('p', { class: 'score' }, `${result.score.me} : ${result.score.opp}`),
    h('p', {}, `획득 포인트 +${result.gained}`),
    !result.won && h('p', { class: 'quote' }, '지면 다시. 한 번 더!'),
    btn('계속', onNext, 'primary'));
}

export function matchScreen({ oppName, oppStyle, canvas, onQuit }) {
  const oppScore = h('span', { class: 'opp-score' }, '0');
  const meScore = h('span', { class: 'me-score' }, '0');
  const judge = h('div', { class: 'judge' }, '');
  return {
    el: h('section', { class: 'screen match' },
      h('div', { class: 'opp-info' }, `${oppName}`, h('small', {}, oppStyle)),
      h('div', { class: 'scoreboard' }, oppScore, ' : ', meScore),
      canvas, judge, btn('포기', onQuit)),
    setScore(me, opp, server) {
      meScore.textContent = `${me}${server === 'me' ? '●' : ''}`;
      oppScore.textContent = `${opp}${server === 'opp' ? '●' : ''}`;
    },
    setJudge(text) { judge.textContent = text; },
  };
}
