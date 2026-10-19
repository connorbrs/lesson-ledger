/** True when the page runs as an installed home-screen app (APP-04). Never throws. */
export function isStandalone(win: Window = window): boolean {
  try {
    if (win.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch {
    // fall through to the iOS-specific flag
  }
  try {
    return (win.navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}
