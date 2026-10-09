// 자작 도트 에셋: 문자열 픽셀맵 + 팔레트. '.' 은 투명.
export const SPRITE_W = 12;
export const SPRITE_H = 16;

// 뒷모습(나): 머리 4행 / 목 / 몸통 4행 / 반바지 3행 / 다리 2행 / 신발 2행
const BACK = [
  '....kkkk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '..khhhhhhk..',
  '...ksssk....',
  '..kcccccck..',
  '.kcccccccck.',
  '.kcccddcccck',
  '..kcccccck..',
  '..kppppppk..',
  '..kppkkppk..',
  '..kpp..ppk..',
  '..kss..ssk..',
  '..kss..ssk..',
  '.kbbb..bbbk.',
  '.kkkk..kkkk.',
];

// 앞모습(상대): 얼굴 있음
const FRONT = [
  '....kkkk....',
  '...khhhhk...',
  '..khhhhhhk..',
  '..khsssshk..',
  '..ksekeksk..',
  '...kssssk...',
  '..kcccccck..',
  '.kcccccccck.',
  '.kcccddcccck',
  '..kcccccck..',
  '..kppppppk..',
  '..kppkkppk..',
  '..kpp..ppk..',
  '..kss..ssk..',
  '.kbbb..bbbk.',
  '.kkkk..kkkk.',
];

// 팔 + 라켓 오버레이 [x, y, 문자]. 프레임 0 대기 / 1 준비(백스윙) / 2 타격
const ARMS = {
  back: [
    [[10, 7, 's'], [10, 8, 's'], [11, 9, 'r'], [11, 10, 'r'], [10, 10, 'r'], [1, 7, 's'], [1, 8, 's']],
    [[11, 5, 's'], [11, 4, 's'], [11, 3, 'r'], [10, 2, 'r'], [11, 2, 'r'], [1, 7, 's'], [1, 8, 's']],
    [[5, 3, 'r'], [6, 3, 'r'], [5, 2, 'r'], [6, 2, 'r'], [9, 6, 's'], [8, 5, 's'], [7, 4, 's'], [1, 7, 's']],
  ],
  front: [
    [[10, 8, 's'], [10, 9, 's'], [11, 10, 'r'], [11, 11, 'r'], [10, 11, 'r'], [1, 8, 's'], [1, 9, 's']],
    [[11, 6, 's'], [11, 5, 's'], [11, 4, 'r'], [10, 3, 'r'], [11, 3, 'r'], [1, 8, 's'], [1, 9, 's']],
    [[5, 12, 'r'], [6, 12, 'r'], [5, 13, 'r'], [6, 13, 'r'], [9, 9, 's'], [8, 10, 's'], [7, 11, 's'], [1, 8, 's']],
  ],
};

export const PALETTES = Object.freeze({
  me: { k: '#14110f', h: '#3a2a1a', s: '#f2c9a0', c: '#ffd24a', d: '#c9a021', p: '#2a3f7a', b: '#f4f4f4', r: '#e03a3a', e: '#14110f' },
  opp: { k: '#14110f', h: '#5a5a66', s: '#f2c9a0', c: '#e8e8f0', d: '#aab0c0', p: '#3a3a44', b: '#f4f4f4', r: '#3a7be0', e: '#14110f' },
  rival: { k: '#14110f', h: '#a02020', s: '#f2c9a0', c: '#d44848', d: '#8e2a2a', p: '#2a2a2a', b: '#f4f4f4', r: '#ffd24a', e: '#14110f' },
});

function compose(base, arms) {
  const rows = base.map((r) => r.split(''));
  for (const [x, y, ch] of arms) rows[y][x] = ch;
  return rows.map((r) => r.join(''));
}

/** 선수 스프라이트: SPRITES.me[frame] / SPRITES.opp[frame] (프레임 0~2) */
export const SPRITES = Object.freeze({
  me: ARMS.back.map((a) => compose(BACK, a)),
  opp: ARMS.front.map((a) => compose(FRONT, a)),
});

// 공 (5x5, 광택) / 라켓 아이콘(타이틀)
export const BALL = ['.kkk.', 'kwwlk', 'kwwwk', 'kwwwk', '.kkk.'];
/** 우승 특전 스킨: 내 팔레트에서 셔츠·바지 색만 바꾼 변형 (키 구성 동일 — 빠진 키는 그려지지 않는다). 라켓(r)·머리·피부는 그대로 */
import { CHAMPION_PERKS } from '../game/perks.js?v=1791531836';
export const SKIN_PALETTES = Object.freeze(Object.fromEntries(Object.entries(CHAMPION_PERKS).map(([lg, p]) => [lg, Object.freeze({ ...PALETTES.me, ...p.palette })])));
export const palettesFor = (skin) => SKIN_PALETTES[skin] ?? PALETTES.me;
export const BALL_PALETTE = { k: '#8a6a2a', w: '#fff6d8', l: '#ffffff' };

export const ICON_PADDLE = [
  '....kkkkkk......',
  '...krrrrrrk.....',
  '..krrrrrrrrk....',
  '..krrrrrrrrk....',
  '..krrrrrrrrk....',
  '..krrrrrrrrk....',
  '...krrrrrrk.....',
  '....kkrrkk......',
  '......kwwk......',
  '......kwwk......',
  '......kwwk...kk.',
  '......kwwk..kyyk',
  '......kkkk..kyyk',
  '.............kk.',
  '................',
  '................',
];
export const ICON_PALETTE = { k: '#14110f', r: '#e03a3a', w: '#d9a05b', y: '#fff6d8' };

/** 스프라이트를 ctx 에 그린다 (fillRect). flipX: 좌우 반전 */
export function drawSprite(ctx, rows, palette, x, y, { scale = 1, flipX = false } = {}) {
  let n = 0;
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      const px = flipX ? row.length - 1 - i : i;
      ctx.fillRect(x + px * scale, y + j * scale, scale, scale);
      n++;
    }
  }
  return n;
}
