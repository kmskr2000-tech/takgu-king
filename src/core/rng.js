// 시드 고정 난수 (mulberry32). 테스트 재현성 확보용.
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // -1..1 균등 분포
  const signed = () => next() * 2 - 1;
  return { next, signed };
}
