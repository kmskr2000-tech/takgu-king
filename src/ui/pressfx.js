// 메뉴 버튼 누름 피드백 (전역 위임): 시각(.pressed → style.css 에서 scale .94 + 어둡게) + 햅틱(짧은 진동, iOS 제외) + 클릭 효과음.
// 경기 중 샷 버튼(.shot-btn)은 자체 스윙 피드백이 있어 제외한다. 비활성 버튼·data-nofx 도 제외.
const BTN = 'button, [role="button"]';
const SKIP = '.shot-btn, [data-nofx]';

/** iOS/iPadOS: navigator.vibrate 미지원이라 진동은 건너뛴다 (iPadOS 는 Mac UA + 터치) */
export function isIOS(nav = globalThis.navigator) {
  const ua = nav?.userAgent ?? '';
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1);
}

export function installPressFeedback(root, { audio, haptics, nav = globalThis.navigator } = {}) {
  if (!root?.addEventListener) return () => {};
  const ios = isIOS(nav);
  let pressed = null; let late = false;
  const release = () => { // 손을 떼면 원복. iOS 처럼 첫 터치에서 오디오가 안 열린 경우 떼는 순간 한 번 더 시도
    if (late) { late = false; audio?.unlock?.(); audio?.play?.('click'); }
    pressed?.classList?.remove('pressed'); pressed = null;
  };
  const down = (ev) => {
    if (ev?.button > 0) return; // 마우스 보조 버튼 제외
    const btn = ev?.target?.closest?.(BTN);
    if (!btn || btn.disabled || btn.closest?.(SKIP)) return;
    release();
    pressed = btn; btn.classList?.add('pressed');
    const had = audio?.ready;
    audio?.unlock?.();
    late = !audio?.play?.('click') && !had; // 지금 못 냈고 오디오가 막 열린(또는 아직 안 열린) 상태면 떼는 순간 재시도
    if (!ios) haptics?.play?.('tap');
  };
  root.addEventListener('pointerdown', down, true);
  root.addEventListener('pointerup', release, true);
  root.addEventListener('pointercancel', release, true);
  root.addEventListener('contextmenu', release, true);
  return () => {
    root.removeEventListener?.('pointerdown', down, true); root.removeEventListener?.('pointerup', release, true);
    root.removeEventListener?.('pointercancel', release, true); root.removeEventListener?.('contextmenu', release, true);
  };
}
