// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ addImage: vi.fn(), write: vi.fn() }));
vi.mock('pptxgenjs', () => ({ default: class {
  addSlide() { return { addImage: mocks.addImage }; }
  write(options) { return mocks.write(options); }
} }));
vi.mock('xlsx', () => ({}));
vi.mock('docx', () => ({}));

beforeAll(async () => { await import('./index.js'); });
beforeEach(() => { mocks.write.mockResolvedValue('generated-pptx-base64'); });

describe('PPTX sandbox image runtime', () => {
  it('exposes cached bdsImage and scoped window aliases without changing global constructors', async () => {
    const original = window.PptxGenJS;
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(message => {
      if (message.type !== 'PPTX_IMAGE_REQUEST') return;
      // An unrelated frame's result must not resolve the image promise.
      window.dispatchEvent(new MessageEvent('message', { source: null,
        data: { type: 'PPTX_IMAGE_RESULT', id: message.id, imageId: message.imageId, image: { data: 'wrong' } },
      }));
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent,
        data: { type: 'PPTX_IMAGE_RESULT', id: message.id, imageId: message.imageId,
          image: { data: 'data:image/png;base64,AA==', width: 100, height: 50, sourceUrl: 'https://example.com/source' } },
      })));
    });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'GEN_PPTX', id: 'runtime', code: `
      const image = await bdsImage("solar panels");
      const cached = await window.bdsImage("solar panels");
      if (cached.data !== image.data) throw new Error("Cache mismatch");
      const pptx = new window.PptxGenJS();
      pptx.addSlide().addImage({ data: image.data, x: 1, y: 1, w: 2, h: 1 });
      await pptx.writeFile({ fileName: "Illustrated.pptx" });
    ` } }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ type: 'PPTX_RESULT', id: 'runtime', base64: 'generated-pptx-base64' }, '*'));
    expect(post.mock.calls.filter(([data]) => data.type === 'PPTX_IMAGE_REQUEST')).toHaveLength(1);
    expect(mocks.addImage).toHaveBeenCalledWith(expect.objectContaining({ data: 'data:image/png;base64,AA==' }));
    expect(window.PptxGenJS).toBe(original);
  });
  it('returns an explicit error if image loading fails', async () => {
    const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(message => {
      if (message.type !== 'PPTX_IMAGE_REQUEST') return;
      queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { source: window.parent,
        data: { type: 'PPTX_IMAGE_RESULT', id: message.id, imageId: message.imageId, error: 'Image unavailable' },
      })));
    });
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'GEN_PPTX', id: 'failed', code: 'await bdsImage("missing");' } }));
    await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ type: 'PPTX_ERROR', id: 'failed', error: 'Image unavailable' }, '*'));
  });
});
