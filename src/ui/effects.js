// 파티클 이펙트: 타격 스파크, 득점 폭죽, 환호 별. 시간/난수 주입 가능(테스트).
const GRAVITY = 60;
const FLASH_S = 0.14;

export function createEffects(rng = { next: Math.random, signed: () => Math.random() * 2 - 1 }) {
  const parts = [];
  let flash = 0; // PERFECT 화면 번쩍임(남은 시간)
  const add = (p) => parts.push({ size: 2, ...p, age: 0 });

  const api = {
    get count() { return parts.length; },
    /** 타격 스파크: PERFECT 는 금색 + 많이, GOOD 은 흰색 */
    hit(x, y, grade = 'GOOD', { scale = 1 } = {}) { // scale: 깊이에 따른 크기(가까울수록 크게)
      const perfect = grade === 'PERFECT';
      const bad = grade === 'BAD';
      if (perfect) { // PERFECT: 빠른 금빛 고리 + 느리게 흩어지는 흰 별 + 번쩍임 (GOOD 보다 확실히 크고 화려하게)
        flash = FLASH_S;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + rng.signed() * 0.12; const sp = 55 + rng.next() * 20;
          add({ x, y, vx: Math.cos(a) * sp * scale, vy: Math.sin(a) * sp * scale, life: 0.4, color: '#ffd24a', g: 0, size: 2 + scale });
        }
        for (let i = 0; i < 8; i++) {
          const a = rng.next() * Math.PI * 2; const sp = 18 + rng.next() * 22;
          add({ x, y, vx: Math.cos(a) * sp * scale, vy: Math.sin(a) * sp * scale - 10, life: 0.55, color: i % 2 ? '#ffffff' : '#fff2a8', g: 20, size: 2 + scale });
        }
        return;
      }
      const n = perfect ? 10 : bad ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.signed() * 0.3;
        const sp = 25 + rng.next() * 25;
        add({ x, y, vx: Math.cos(a) * sp * scale, vy: Math.sin(a) * sp * scale, life: 0.35, color: perfect ? '#ffd24a' : bad ? '#9aa4ae' : '#ffffff', g: 0, size: 1 + scale + (perfect ? 1 : 0) });
      }
    },
    /** 상성 카운터 악센트: 금빛 스파크 10개 (PERFECT 의 고리·번쩍임보다 작다) */
    counter(x, y, scale = 1) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + rng.signed() * 0.3; const sp = 25 + rng.next() * 25;
        add({ x, y, vx: Math.cos(a) * sp * scale, vy: Math.sin(a) * sp * scale, life: 0.35, color: '#ffd24a', g: 0, size: 1 + scale });
      }
    },
    /** 득점: 내가 득점하면 색종이, 실점이면 회색 연기 */
    score(x, y, mine) {
      const colors = ['#ff5a4a', '#ffd24a', '#4aa3ff', '#7be07b'];
      const n = mine ? 18 : 8;
      for (let i = 0; i < n; i++) {
        add({
          x, y, vx: rng.signed() * 40, vy: -30 - rng.next() * 40, life: mine ? 0.9 : 0.6,
          color: mine ? colors[i % colors.length] : '#8d98a5', g: mine ? GRAVITY : -10, size: mine ? 2 : 3,
        });
      }
    },
    /** 환호 (경기 승리): 별이 위로 흩어진다 */
    cheer(w, h) {
      for (let i = 0; i < 30; i++) {
        add({ x: rng.next() * w, y: h, vx: rng.signed() * 15, vy: -50 - rng.next() * 60, life: 1.4, color: i % 2 ? '#ffd24a' : '#ffffff', g: 20 });
      }
    },
    /** PERFECT 번쩍임 세기 0..1 (렌더러가 화면 위에 흰금색 막을 얹는다) */
    get flashAlpha() { return flash > 0 ? flash / FLASH_S : 0; },
    update(dt) {
      flash = Math.max(0, flash - dt);
      for (const p of parts) {
        p.age += dt;
        p.vy += (p.g ?? 0) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
    },
    draw(ctx) {
      for (const p of parts) {
        ctx.fillStyle = p.color;
        const s = p.age > p.life * 0.7 ? 1 : p.size; // 끝나갈수록 작아짐
        ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
    },
    clear() { parts.length = 0; flash = 0; },
  };
  return api;
}
