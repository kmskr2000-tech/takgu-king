// 설정: 시즌 저장과 분리된 별도 키 (새로 시작/데이터 삭제로 지워지지 않음)
export const SETTINGS_KEY = 'tabgu-king-settings-v1';

export const SETTING_DEFS = Object.freeze([
  { key: 'sound', label: '사운드', desc: '타격·득점·승리 효과음' },
  { key: 'vibration', label: '진동', desc: '타격·득점 때 폰이 진동 (지원 기기만)' },
  { key: 'effects', label: '이펙트', desc: '타격 스파크, 득점 폭죽, 환호' },
  { key: 'shake', label: '화면 흔들림', desc: '실점했을 때 화면이 살짝 흔들림' },
  { key: 'guide', label: '타이밍 가이드', desc: '타이밍 존 표시 (끄면 훨씬 어려워짐)' },
]);

export const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(SETTING_DEFS.map((d) => [d.key, true])));

export function createSettings(storage = globalThis.localStorage) {
  let cur = { ...DEFAULT_SETTINGS };
  try {
    const raw = JSON.parse(storage?.getItem(SETTINGS_KEY) ?? 'null');
    if (raw && typeof raw === 'object') for (const k of Object.keys(DEFAULT_SETTINGS)) if (typeof raw[k] === 'boolean') cur[k] = raw[k];
  } catch { cur = { ...DEFAULT_SETTINGS }; }
  const persist = () => { try { storage?.setItem(SETTINGS_KEY, JSON.stringify(cur)); } catch { /* 저장 불가여도 현재 세션엔 적용 */ } };
  return {
    get: () => ({ ...cur }),
    set(key, value) {
      if (!(key in DEFAULT_SETTINGS)) throw new Error(`알 수 없는 설정: ${key}`);
      cur[key] = !!value; persist(); return cur[key];
    },
    toggle(key) { return this.set(key, !cur[key]); },
    reset() { cur = { ...DEFAULT_SETTINGS }; persist(); },
  };
}
