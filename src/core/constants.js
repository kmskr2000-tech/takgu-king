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
export const PERFECT_RATIO = 0.15; // 존 중앙 15% 구간 (0.3→0.15: 사람 탭 오차 σ0.06s 에서 PERFECT 65%→38%, scripts/sim-grades.mjs). 구질별 밴드(RHYTHM_SHIFT ±0.5)의 PERFECT 구간은 겹치지 않는다
export const FOCUS_WIDEN = 0.06; // 집중 1당 판정 폭 증가율
export const MIN_HALF_TIME = 0.06;
/** 공정성 하한(설계안 §6.4): 바운드→밴드 중심까지 이 시간(초) 아래로 내려가는 AI 공은 만들지 않는다 (사용자 지시 200ms. 게임 난이도 배율로도 우회 불가) */
export const MIN_REACTION_S = 0.2;
export const BOUNCE_GRACE = 0.05; // 바운드 직후 리턴 불가 유예(초)

export const SIDES = Object.freeze({ ME: 'me', OPP: 'opp' });
export const GRADES = Object.freeze({ PERFECT: 'PERFECT', GOOD: 'GOOD', BAD: 'BAD', MISS: 'MISS' });
// BAD(아슬아슬): 받아주는 범위(leniency) 바깥쪽 이 비율 이상. 리턴은 성공하지만 위력↓ 오차↑ 네트율↑ (타이밍 4단계: PERFECT/GOOD/BAD/MISS)
export const BAD_FRACTION = 0.3;
// AI 의 타이밍 판정은 예전 값 그대로: 사람 쪽 PERFECT/BAD 구간을 줄여도 AI 의 타격 품질(PERFECT 비율)은 변하지 않는다 → 난이도 상향은 플레이어 쪽에만 (2026-10-07)
export const AI_PERFECT_RATIO = 0.3;
export const AI_BAD_FRACTION = 0.75;
export const STATES = Object.freeze({
  SERVE: 'SERVE',
  RALLY: 'RALLY',
  POINT: 'POINT',
  GAME_END: 'GAME_END',
});
export const WIN_SCORE = 11;
export const DEUCE_AT = 10;

// 입력 (px 기준, 모바일 터치)
// 드래그 거리는 화면(코트) 폭 비율 — 기기 크기와 무관하게 같은 손맛. (폭 300px 기준: 최소 ≈13px, 파워 최대 ≈120px)
export const DRAG_MIN_FRAC = 0.045; // 이 비율 미만 이동은 탭으로 간주
export const DRAG_FULL_FRAC = 0.4; // 이 비율 이상이면 파워 최대 (0.2초 안에 쓸 수 있는 거리)
export const DRAG_MIN_PX = 8; // 아주 작은 화면에서의 하한
export const COMMIT_WINDOW = 0.15; // 고급 조작: 탭 후 이 시간(초) 안에 샷을 확정한다 (손을 안 떼도). 이게 없으면 뗄 때까지 공이 멈춘 듯 보인다
export const TAP_POWER = 0.35; // 그냥 탭의 기본 파워
export const DRAG_VERTICAL_RATIO = 0.6; // 세로 성분이 가로의 이 비율 이상이어야 스핀 드래그
export const COURSE_X = Object.freeze({ left: 20, center: 50, right: 80 });
