// 경기 요약 지표 + 개인 기록 (리텐션 보고서 축 ①). 기존 경기 이벤트만 읽는다 — 물리·판정·밸런스 불변, 포인트 보상 없음(기록 자랑용).
// 집계는 앱 계층에서: grade 이벤트 = 내 탭의 PERFECT/GOOD/BAD (MISS 도 같이 나오지만), missed 이벤트 = 모든 MISS(무탭 포함).
// → P/G/B 는 grade 에서, MISS 는 missed 에서만 센다 (탭 MISS 는 두 이벤트를 모두 내기 때문에 중복 방지).
export const RECORDS_KEY = 'tabgu-king-records-v1';
/** 최고 PERFECT율 기록은 이 타수 이상 친 경기에서만 인정 (3타 100% 같은 우연 방지) */
export const MIN_TAPS_FOR_RATE = 20;

/** 한 경기 집계기. handle(event) 로 이벤트를 먹이고 summary() 로 결과를 읽는다 */
export function createMatchTally() {
  const t = { perfect: 0, good: 0, bad: 0, miss: 0, counters: 0, longestRally: 0, specials: 0 };
  return {
    handle(e) {
      if (e.type === 'grade') {
        if (e.grade === 'PERFECT') t.perfect++; else if (e.grade === 'GOOD') t.good++; else if (e.grade === 'BAD') t.bad++;
        if (e.grade !== 'MISS' && e.matchup === 'win') t.counters++; // 상성 유리 카운터
      } else if (e.type === 'missed') t.miss++;
      else if (e.type === 'special') t.specials++;
      else if (e.type === 'point') t.longestRally = Math.max(t.longestRally, e.rallyShots ?? 0);
    },
    summary() {
      const taps = t.perfect + t.good + t.bad + t.miss;
      return { ...t, taps, perfectRate: taps > 0 ? t.perfect / taps : null };
    },
  };
}

const EMPTY = () => ({ matches: 0, wins: 0, totalPerfect: 0, bestPerfectRate: 0, bestRally: 0, bestCounters: 0, bestSpecials: 0 });

const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
function sanitize(raw) {
  const r = EMPTY();
  if (raw && typeof raw === 'object') for (const k of Object.keys(r)) r[k] = num(raw[k]);
  r.bestPerfectRate = Math.min(1, r.bestPerfectRate);
  return r;
}

/** 저장소: 시즌 저장과 별도 키 — 새로 시작해도 기록은 남고, 저장 데이터 삭제로 지워진다 */
export function createRecordsStore(storage = globalThis.localStorage) {
  return {
    load() { try { const raw = storage?.getItem(RECORDS_KEY); return sanitize(raw ? JSON.parse(raw) : null); } catch { return EMPTY(); } },
    save(rec) { try { storage?.setItem(RECORDS_KEY, JSON.stringify(rec)); return true; } catch { return false; } },
    clear() { try { storage?.removeItem(RECORDS_KEY); } catch { /* 무시 */ } },
    /** 한 경기를 기록에 반영. 반환: { records, broken } — broken 은 이전 기록이 있었는데 넘어선 항목 id 목록 */
    apply(summary, { won = false } = {}) {
      const rec = this.load();
      const { next, broken } = applySummary(rec, summary, won);
      this.save(next);
      return { records: next, broken };
    },
  };
}

/** 순수 함수: 기록 + 경기 요약 → 새 기록과 갱신 항목. 첫 기록(이전 0)은 '신기록' 표시를 하지 않는다 */
export function applySummary(rec, s, won) {
  const next = { ...rec, matches: rec.matches + 1, wins: rec.wins + (won ? 1 : 0), totalPerfect: rec.totalPerfect + s.perfect };
  const broken = [];
  const take = (id, key, value) => { if (value > rec[key]) { if (rec[key] > 0) broken.push(id); next[key] = value; } };
  if (s.perfectRate != null && s.taps >= MIN_TAPS_FOR_RATE) take('perfectRate', 'bestPerfectRate', s.perfectRate);
  take('rally', 'bestRally', s.longestRally);
  take('counters', 'bestCounters', s.counters);
  take('specials', 'bestSpecials', s.specials);
  return { next, broken };
}

export const RECORD_LABELS = Object.freeze({ perfectRate: 'PERFECT율', rally: '최장 랠리', counters: '카운터', specials: '필살기' });
