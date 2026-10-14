// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ searchWeb: vi.fn(), sendFileWithMessage: vi.fn(), injectPureTextAndSend: vi.fn(), clearRunSearchHistory: vi.fn() }));
vi.mock('../../src/content/auto.js', () => mocks);
vi.mock('../../src/content/files/search-reader.js', () => ({ searchWeb: mocks.searchWeb, resolveSearchProviders: p => p }));
import state from '../../src/content/state.js';
import { createRun, getCurrentConversationId, initDeepResearchRuntime } from '../../src/content/deep-research.js';

const plan = { title: 'Research', steps: [{ id: '1', action: 'search', query: 'solar energy', purpose: 'evidence' }] };
const dispatchPlan = (runId, value = plan) => window.dispatchEvent(new CustomEvent('bds:deep-research-plan-received', {
  detail: { runId, conversationId: getCurrentConversationId(), plan: value },
}));
beforeAll(async () => { initDeepResearchRuntime(); await Promise.resolve(); });
beforeEach(() => {
  state.deepResearch.enabled = true;
  state.deepResearch.runs = [];
  state.settings.deepResearchAutoAgree = true;
  state.settings.deepResearchContextGuardEnabled = false;
  const file = new File(['Research evidence'], 'evidence.md', { type: 'text/markdown' });
  Object.defineProperty(file, 'text', { value: async () => 'Research evidence' });
  mocks.searchWeb.mockResolvedValue({ query: 'solar energy', results: [{ title: 'Source', url: 'https://example.com', snippet: 'Evidence' }], file });
  mocks.sendFileWithMessage.mockResolvedValue(true);
  mocks.injectPureTextAndSend.mockResolvedValue(true);
});
describe('Deep Research auto-agree', () => {
  it('starts a valid active plan once without pressing Approve', async () => {
    const run = createRun(getCurrentConversationId(), 'active');
    state.deepResearch.runs = [run];
    dispatchPlan(run.id);
    dispatchPlan(run.id);
    expect(run.status).toBe('running');
    expect(run.execution.managed).toBe(true);
    await vi.waitFor(() => expect(run.execution.awaitingAnalysisStepId).toBe('1'));
    expect(mocks.searchWeb).toHaveBeenCalledOnce();
    expect(mocks.sendFileWithMessage).toHaveBeenCalledOnce();
  });
  it('keeps manual approval when the setting is off', () => {
    state.settings.deepResearchAutoAgree = false;
    const run = createRun(getCurrentConversationId(), 'manual');
    state.deepResearch.runs = [run];
    dispatchPlan(run.id);
    expect(run.status).toBe('planning');
    expect(mocks.searchWeb).not.toHaveBeenCalled();
  });
  it.each(['complete', 'cancelled', 'running', 'reporting'])('does not restart a %s run', status => {
    const run = createRun(getCurrentConversationId(), 'old');
    run.status = status;
    state.deepResearch.runs = [run];
    dispatchPlan(run.id);
    expect(run.status).toBe(status);
    expect(mocks.searchWeb).not.toHaveBeenCalled();
  });
  it('does not auto-approve historical, malformed or other-conversation plans', () => {
    dispatchPlan('history');
    const run = createRun(getCurrentConversationId(), 'invalid');
    state.deepResearch.runs.push(run);
    dispatchPlan(run.id, { title: 'Broken', steps: [{ action: 'search' }] });
    expect(run.status).toBe('planning');
    const other = createRun('other-conversation', 'other');
    state.deepResearch.runs.push(other);
    dispatchPlan(other.id);
    expect(other.status).toBe('planning');
    expect(mocks.searchWeb).not.toHaveBeenCalled();
  });
  it('does not start anything after research is turned off', () => {
    const run = createRun(getCurrentConversationId(), 'disabled');
    state.deepResearch.runs = [run];
    state.deepResearch.enabled = false;
    dispatchPlan(run.id);
    expect(mocks.searchWeb).not.toHaveBeenCalled();
  });
});
