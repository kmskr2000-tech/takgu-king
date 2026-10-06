// 코트 좌표계: x 0..100(폭), y 0..200(길이). y=0 이 상대 끝선, y=200 이 내 끝선, 네트 y=100.
export const TABLE_W = 100;
export const TABLE_L = 200;
export const NET_Y = 100;
export const NET_H = 20;
export const HIT_Z = 12; // 타구 높이

export const G = 500; // 기본 중력 (단위/s²)
export const SPIN_G = 0.35; // 스핀 1.0 일 때 중력 변화율 (탑스핀=하강 가속, 백스핀=부양)
export const SPIN_SPEED_TOP = 0.18; // 탑스핀: 더 빠르게
export const SPIN_SPEED_BACK = 0.35; // 백스핀(커트): 더 느리게

export const SPEED_MIN = 170;
export const SPEED_MAX = 330;

// 바운드
export const REST_Y = 0.8;
export const SPIN_KICK = 0.2; // 탑스핀=전진 가속, 백스핀=감속
export const REST_MIN = 0.3;
export const REST_X = 0.9;

// 타이밍 존: 바운드 지점에서 공이 이만큼 더 진행한 곳이 존 중심
export const ZONE_OFFSET = 20;
export const ZONE_HALF = 25;
export const PERFECT_RATIO = 0.3; // 존 중앙 30% 구간
export const FOCUS_WIDEN = 0.06; // 집중 1당 판정 폭 증가율
export const MIN_HALF_TIME = 0.06;
export const BOUNCE_GRACE = 0.05; // 바운드 직후 리턴 불가 유예(초)

export const SIDES = Object.freeze({ ME: 'me', OPP: 'opp' });
export const GRADES = Object.freeze({ PERFECT: 'PERFECT', GOOD: 'GOOD', MISS: 'MISS' });
export const STATES = Object.freeze({
  SERVE: 'SERVE',
  RALLY: 'RALLY',
  POINT: 'POINT',
  GAME_END: 'GAME_END',
});
export const WIN_SCORE = 11;
export const DEUCE_AT = 10;

// 입력 (px 기준, 모바일 터치)
export const DRAG_MIN = 14; // 이 길이 미만 이동은 탭으로 간주
export const DRAG_FULL = 160; // 이 길이 이상이면 파워 최대
export const TAP_POWER = 0.35; // 그냥 탭의 기본 파워
export const DRAG_VERTICAL_RATIO = 0.6; // 세로 성분이 가로의 이 비율 이상이어야 스핀 드래그
export const COURSE_X = Object.freeze({ left: 20, center: 50, right: 80 });
