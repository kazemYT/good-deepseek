// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import state from './state.js';
import { tryAutoContinue } from './auto-continue.js';

function setup(extra = '') {
  document.body.innerHTML = `<div class="ds-message" data-message-author-role="assistant">
    <div class="ds-markdown">Partial answer</div>
    <div role="button" class="ds-button"><span class="ds-button__content">Continue</span></div>
    ${extra}</div>`;
  const button = document.querySelector('[role="button"]');
  button.click = vi.fn();
  return button;
}
beforeEach(() => {
  state.settings.autoContinue = true;
  state.network.activeCompletionRequests = 0;
  document.body.innerHTML = '';
});
describe('auto-continue', () => {
  it('recognizes the actual Continue control from the supplied saved page', () => {
    const saved = readFileSync(`${process.cwd()}/Binary filler data - DeepSeek.html`, 'utf8');
    document.body.innerHTML = new DOMParser().parseFromString(saved, 'text/html').body.innerHTML;
    const button = [...document.querySelectorAll('[role="button"]')].find(el => el.textContent.trim() === 'Continue');
    expect(button).toBeTruthy();
    button.click = vi.fn();
    expect(tryAutoContinue()).toBe(true);
    expect(button.click).toHaveBeenCalledOnce();
    expect(tryAutoContinue()).toBe(false);
  });
  it('clicks once per reply and supports a reused button after another continuation', () => {
    const button = setup();
    expect(tryAutoContinue()).toBe(true);
    expect(tryAutoContinue()).toBe(false);
    document.querySelector('.ds-markdown').textContent += ' More generated content';
    expect(tryAutoContinue()).toBe(true);
    expect(button.click).toHaveBeenCalledTimes(2);
  });
  it('does not click when disabled, generating, or aria-disabled', () => {
    const button = setup();
    state.settings.autoContinue = false;
    expect(tryAutoContinue()).toBe(false);
    state.settings.autoContinue = true;
    state.network.activeCompletionRequests = 1;
    expect(tryAutoContinue()).toBe(false);
    state.network.activeCompletionRequests = 0;
    button.setAttribute('aria-disabled', 'true');
    expect(tryAutoContinue()).toBe(false);
    expect(button.click).not.toHaveBeenCalled();
  });
  it('ignores historical replies, user messages, hidden controls and extension cards', () => {
    const button = setup();
    document.body.insertAdjacentHTML('beforeend', '<div class="ds-message d29f3d7d">New user message</div>');
    expect(tryAutoContinue()).toBe(false);
    expect(button.click).not.toHaveBeenCalled();
    setup();
    document.querySelector('[role="button"]').style.display = 'none';
    expect(tryAutoContinue()).toBe(false);
    setup();
    document.querySelector('[role="button"]').className = 'bds-host-wrapper';
    expect(tryAutoContinue()).toBe(false);
  });
  it.each(['Продолжить', '继续生成', 'Continue generating'])('supports %s', label => {
    const button = setup();
    button.querySelector('span').textContent = label;
    expect(tryAutoContinue()).toBe(true);
  });
});
