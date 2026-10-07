// iOS(특히 iOS 27 홈 화면 앱)는 상태바 바로 아래 약 20px 띠에 시스템 흐림을 덧그린다.
// 그 띠에 걸친 DOM 요소(경기 화면 상단 줄: 상대 이름·배지·포기)가 통째로 뿌옇게 보이고, 페이지 CSS(filter·합성 레이어·불투명 바탕)로는
// 끌 수 없다 (외부 실기기 보고: github.com/Yeraze/meshmonitor/issues/5286 — 글자를 띠 밖으로 내리는 것만 효과).
// 그래서 iOS WebKit 에서는 <html> 에 클래스를 달아 CSS 변수 --ios-top-gap 으로 HUD 를 띠 아래로 내린다(style.css).
// 상단 안전영역이 0 이면(가로 화면·노치 없는 환경) CSS 에서 0 으로 잘린다.
export const IOS_TOP_GAP_CLASS = 'ios-top-gap';

/**
 * iOS/iPadOS 의 WebKit(사파리 탭·홈 화면 앱·iOS 의 다른 브라우저 포함)인지.
 * 홈 화면 앱의 UA 에는 `Version/NN` 이 없을 수 있고, display-mode 미디어 쿼리도 믿을 수 없어 둘 다 쓰지 않는다.
 * iPadOS 13+ 는 데스크톱(Macintosh) UA 를 보내므로 터치 포인트로 구분한다.
 */
export function isIosWebKit({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/\b(iPhone|iPad|iPod)\b/.test(userAgent) || /^(iPhone|iPad|iPod)/.test(platform)) return true;
  if (/\bAndroid\b/.test(userAgent)) return false;
  return /\bMacintosh\b/.test(userAgent) && Number(maxTouchPoints) > 1;
}

/** <html> 에 iOS 상단 흐림 회피 클래스를 단다. 문서·navigator 가 없으면(테스트 스텁·서버) 아무것도 안 한다. 반환: 적용 여부 */
export function applyIosTopGap(doc = globalThis.document, nav = globalThis.navigator) {
  const root = doc?.documentElement;
  if (!root?.classList || !nav) return false;
  const on = isIosWebKit(nav);
  if (on) root.classList.add(IOS_TOP_GAP_CLASS);
  return on;
}
