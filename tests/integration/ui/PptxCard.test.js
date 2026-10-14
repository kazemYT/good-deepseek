// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ searchImages: vi.fn(), triggerBlobDownload: vi.fn(), handleAutoErrorReport: vi.fn() }));
vi.mock('../../../src/lib/wikimedia-commons.js', () => mocks);
vi.mock('../../../src/lib/utils/download.js', () => mocks);
vi.mock('../../../src/content/auto.js', () => mocks);
import PptxCard from '../../../src/content/ui/PptxCard.svelte';
import { renderSvelte, flushUi } from '../../helpers/svelte.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.stubGlobal('Image', class {
    naturalWidth = 800;
    naturalHeight = 600;
    set src(_) { queueMicrotask(() => this.onload()); }
  });
});
afterEach(() => vi.unstubAllGlobals());

async function startCard() {
  const card = renderSvelte(PptxCard, { content: 'const pptx = new PptxGenJS(); await pptx.writeFile({ fileName: "Test.pptx" });' });
  await flushUi();
  const frame = card.target.querySelector('iframe');
  const post = vi.spyOn(frame.contentWindow, 'postMessage').mockImplementation(() => {});
  card.target.querySelector('.bds-btn').click();
  await flushUi();
  const id = post.mock.calls[0][0].id;
  return { ...card, frame, post, id };
}
function send(frame, data, source = frame.contentWindow) {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}
describe('PPTX sandbox image bridge', () => {
  it('loads a Commons image through the background and returns embedded data with credits', async () => {
    const { frame, post, id, cleanup } = await startCard();
    mocks.searchImages.mockResolvedValue({ thumbUrl: 'https://upload.wikimedia.org/solar.png', descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Solar.png', title: 'Solar panels' });
    chrome.runtime.sendMessage.mockResolvedValue({ ok: true, data: 'data:image/png;base64,AAAA' });
    send(frame, { type: 'PPTX_IMAGE_REQUEST', id, imageId: 'image-1', query: 'solar panels' });
    await flushUi();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'bds-fetch-presentation-image', url: 'https://upload.wikimedia.org/solar.png' });
    await vi.waitFor(() => expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'PPTX_IMAGE_RESULT', imageId: 'image-1', image: expect.objectContaining({ data: 'data:image/png;base64,AAAA', width: 800, height: 600, sourceUrl: 'https://commons.wikimedia.org/wiki/File:Solar.png' }) }), '*'));
    cleanup();
  });
  it('rejects messages from other frames and propagates image failures', async () => {
    const { frame, post, id, cleanup } = await startCard();
    send(frame, { type: 'PPTX_IMAGE_REQUEST', id, imageId: 'bad', query: 'subject' }, window);
    await flushUi();
    expect(mocks.searchImages).not.toHaveBeenCalled();
    mocks.searchImages.mockResolvedValue(null);
    send(frame, { type: 'PPTX_IMAGE_REQUEST', id, imageId: 'missing', query: 'missing subject' });
    await flushUi();
    expect(post).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'PPTX_IMAGE_RESULT', error: 'No illustration found for: missing subject' }), '*');
    cleanup();
  });
  it('still downloads sandbox output and removes message handlers on unmount', async () => {
    const { frame, id, cleanup } = await startCard();
    send(frame, { type: 'PPTX_RESULT', id, base64: btoa('pptx bytes') });
    await flushUi();
    expect(mocks.triggerBlobDownload).toHaveBeenCalledWith(expect.any(Blob), 'Test.pptx');
    cleanup();
    send(frame, { type: 'PPTX_RESULT', id, base64: btoa('pptx bytes') });
    expect(mocks.triggerBlobDownload).toHaveBeenCalledOnce();
  });
});
