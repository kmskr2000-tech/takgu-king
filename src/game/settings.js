// 설정: 시즌 저장과 분리된 별도 키 (새로 시작/데이터 삭제로 지워지지 않음)
import { DIFFICULTY, DIFFICULTY_ORDER, DEFAULT_DIFFICULTY } from './difficulty.js?v=1791353507';
import { BALL_SPEED, BALL_SPEED_ORDER, DEFAULT_BALL_SPEED } from './ballspeed.js?v=1791353507';
import { GAME_LEVELS, GAME_LEVEL_ORDER, DEFAULT_GAME_LEVEL } from './gamelevel.js?v=1791353507';
import { CONTROL_MODES, CONTROL_ORDER, DEFAULT_CONTROL_MODE } from './controls.js?v=1791353507';

export const SETTINGS_KEY = 'tabgu-king-settings-v1';

const bool = (key, label, desc) => ({ key, type: 'bool', label, desc });
export const SETTING_DEFS = Object.freeze([
  {
    key: 'gameLevel', type: 'enum', label: '게임 난이도', default: DEFAULT_GAME_LEVEL,
    options: GAME_LEVEL_ORDER.map((v) => ({ value: v, label: GAME_LEVELS[v].label, desc: GAME_LEVELS[v].desc })),
    desc: '상대 AI 의 정확도·반응·패턴 읽기·리듬 변칙을 리그 난이도에 곱함 (타이틀 화면에서도 고를 수 있음)',
  },
  {
    key: 'difficulty', type: 'enum', label: '조작 난이도', default: DEFAULT_DIFFICULTY,
    options: DIFFICULTY_ORDER.map((v) => ({ value: v, label: DIFFICULTY[v].label, desc: DIFFICULTY[v].desc })),
    desc: '탭 판정 범위(쉬움 1.6배 / 보통 1.3배 / 어려움 기존)와 코스 자동 보정(쉬움만)',
  },
  {
    key: 'controls', type: 'enum', label: '조작 방식', default: DEFAULT_CONTROL_MODE,
    options: CONTROL_ORDER.map((v) => ({ value: v, label: CONTROL_MODES[v].label, desc: CONTROL_MODES[v].desc })),
    desc: '간단: 탭 한 번 + 샷 선택 버튼 / 고급: 탭 + 쓸기(스핀·파워 직접 조절)',
  },
  {
    key: 'ballSpeed', type: 'enum', label: '공 속도', default: DEFAULT_BALL_SPEED,
    options: BALL_SPEED_ORDER.map((v) => ({ value: v, label: BALL_SPEED[v].label, desc: BALL_SPEED[v].desc })),
    desc: '공이 날아오는 빠르기 (느릴수록 판정 시간이 길어짐, 궤적·난이도 곡선은 그대로)',
  },
  bool('tips', '플레이 힌트', '처음 몇 번만 조작 방법을 짧게 알려줌'),
  bool('sound', '사운드', '타격·득점·승리 효과음 (끄면 배경음악도 함께 꺼짐)'),
  bool('bgm', '배경음악', '도트 풍 배경음악 (메뉴·경기)'),
  bool('vibration', '진동', '타격·득점 때 폰이 진동 (지원 기기만)'),
  bool('effects', '이펙트', '타격 스파크, 득점 폭죽, 환호'),
  bool('shake', '화면 흔들림', '실점했을 때 화면이 살짝 흔들림'),
  bool('guide', '타이밍 가이드', '타이밍 존 표시 (끄면 훨씬 어려워짐)'),
  bool('intro', '인트로 연출', '게임을 켤 때 짧은 오프닝, 새로 시작할 때 도민구 소개 컷신 (탭하면 넘김·건너뛰기)'),
]);

export const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d.type === 'enum' ? d.default : true])));
const DEF = Object.freeze(Object.fromEntries(SETTING_DEFS.map((d) => [d.key, d])));
const valid = (d, v) => (d.type === 'enum' ? d.options.some((o) => o.value === v) : typeof v === 'boolean');

export function createSettings(storage = globalThis.localStorage) {
  let cur = { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    // 키별 타입 검증: 잘못된 값만 기본값으로 두고 나머지는 살린다 (구버전 저장 호환: 새 키는 기본값)
    if (raw && typeof raw === 'object') for (const d of SETTING_DEFS) if (valid(d, raw[d.key])) cur[d.key] = raw[d.key];
  } catch { cur = { ...DEFAULT_SETTINGS }; }
  const persist = () => { try { storage?.setItem(SETTINGS_KEY, JSON.stringify(cur)); } catch { /* 저장 불가여도 현재 세션엔 적용 */ } };
  return {
    get: () => ({ ...cur }),
    set(key, value) {
      const d = DEF[key];
      if (!d) throw new Error(`알 수 없는 설정: ${key}`);
      cur[key] = d.type === 'enum' ? (valid(d, value) ? value : (() => { throw new Error(`잘못된 값: ${key}=${value}`); })()) : !!value;
      persist(); return cur[key];
    },
    toggle(key) { return this.set(key, !cur[key]); },
    /** 열거형은 다음 값으로 순환, 불리언은 토글 */
    cycle(key) {
      const d = DEF[key];
      if (d?.type !== 'enum') return this.toggle(key);
      const i = d.options.findIndex((o) => o.value === cur[key]);
      return this.set(key, d.options[(i + 1) % d.options.length].value);
    },
    reset() { cur = { ...DEFAULT_SETTINGS }; persist(); },
  };
}
