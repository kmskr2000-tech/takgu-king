// 훈련 모드 (정규 시즌 밖 연습 경기). 시즌 상태(주차·로그·팀·순위·속보·라이벌 스토리)를 건드리지 않는다.
//  - 하루 도전 한도: 날짜(기기 현지 날짜)별로 TRAIN_DAILY_LIMIT 회. 경기 시작 때 차감하므로 나가기로 환불받을 수 없다.
//  - 보상은 소액(승리 +1 포인트, 하루 최대 +3 = 한 시즌 포인트의 10% 안팎). 개인 기록·리그 순위에는 반영하지 않는다.
//  - 상대: 지금 리그의 중위권 선수(게임 난이도 설정 적용).
import { makeAiParams } from '../core/index.js?v=1791531836';

export const TRAIN_DAILY_LIMIT = 3;
export const TRAIN_WIN_POINTS = 1;
export const TRAIN_KEY = 'tabgu-king-training-v1';
export const TRAIN_OPPONENT = Object.freeze({ name: '훈련 파트너', style: 'balanced', rival: false, tier: 'mid' });

/** 기기 현지 날짜 키 (YYYY-MM-DD) */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 오늘 훈련 횟수 저장소. today: 날짜 키를 돌려주는 함수(테스트 주입) */
export function createTrainingStore(storage = globalThis.localStorage, { today = () => dayKey() } = {}) {
  const read = () => {
    try {
      const o = JSON.parse(storage?.getItem(TRAIN_KEY) ?? 'null');
      return o && o.day === today() && Number.isFinite(o.used) && o.used >= 0 ? { day: o.day, used: Math.floor(o.used) } : { day: today(), used: 0 };
    } catch { return { day: today(), used: 0 }; }
  };
  const write = (o) => { try { storage?.setItem(TRAIN_KEY, JSON.stringify(o)); return true; } catch { return false; } };
  return {
    status() { const { used } = read(); return { used, left: Math.max(0, TRAIN_DAILY_LIMIT - used), limit: TRAIN_DAILY_LIMIT }; },
    /** 도전 1회 사용. 남은 횟수가 없으면 false. 저장에 실패하면(저장소 차단) 한도를 지킬 수 없으므로 false */
    consume() { const o = read(); if (o.used >= TRAIN_DAILY_LIMIT) return false; return write({ day: o.day, used: o.used + 1 }); },
    clear() { try { storage?.removeItem(TRAIN_KEY); } catch { /* 무시 */ } },
  };
}

/** 훈련 상대 AI 파라미터 */
export const trainingParams = (league, cycle = 1) => makeAiParams(league, TRAIN_OPPONENT.tier, TRAIN_OPPONENT.style, cycle);
export const trainingReward = (won) => (won ? TRAIN_WIN_POINTS : 0);
