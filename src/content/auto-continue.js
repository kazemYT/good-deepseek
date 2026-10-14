/** Only click the native continuation control on the latest assistant reply. */
import state from "./state.js";

const clicked = new WeakMap();
const CONTINUE_LABEL = /^(?:continue|continue generating|продолжить|продолжить генерацию|ادامه|ادامه تولید|devam et|继续|继续生成)$/i;

export function tryAutoContinue() {
  if (!state.settings.autoContinue || state.network.activeCompletionRequests > 0 ||
      document.querySelector(".ds-icon-stop-circle, .ds-icon-stop")) return false;
  const messages = document.querySelectorAll('.ds-message');
  const latest = messages[messages.length - 1];
  if (!latest || latest.matches('[data-role="user"], [data-message-role="user"], [data-message-author-role="user"], .d29f3d7d, .fbb737a4')) return false;
  // DeepSeek puts reply actions beside .ds-message, inside the assistant row.
  const actionRoot = latest.closest('div._4f9bf79._43c05b5') || latest;
  for (const button of actionRoot.querySelectorAll('button, [role="button"]')) {
    if (button.closest('.bds-host-wrapper, #bds-root, .ds-markdown, pre, code')) continue;
    const label = (button.querySelector('.ds-button__content')?.textContent || button.textContent || '').trim();
    const signature = latest.querySelector(".ds-markdown")?.textContent || latest.textContent;
    if (!CONTINUE_LABEL.test(label) || clicked.get(button) === signature) continue;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true' ||
        [...button.classList].some(c => c.endsWith('--disabled'))) continue;
    if (button.closest('[hidden], [aria-hidden="true"]') || getComputedStyle(button).display === 'none' ||
        getComputedStyle(button).visibility === 'hidden') continue;
    clicked.set(button, signature);
    button.click();
    return true;
  }
  return false;
}
