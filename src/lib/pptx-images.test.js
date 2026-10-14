import { describe, expect, it, vi } from 'vitest';
import PptxGenJS from 'pptxgenjs';
import { unzipSync, strFromU8 } from 'fflate';
import { createPresentationClass } from './pptx-images.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==';
describe('illustrated PPTX export', () => {
  it('embeds remote images, caches downloads and waits before writing a real PPTX', async () => {
    const loader = vi.fn(async () => ({ data: PNG }));
    const onWrite = vi.fn();
    const original = PptxGenJS.prototype.writeFile;
    const Presentation = createPresentationClass(PptxGenJS, loader, onWrite);
    const pptx = new Presentation();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.addSlide().addImage({ path: 'https://example.com/picture.png', x: 1, y: 1, w: 2, h: 2 });
    pptx.addSlide().addImage({ path: 'https://example.com/picture.png', x: 1, y: 1, w: 2, h: 2 });
    const result = await pptx.writeFile({ fileName: 'Illustrated.pptx' });
    const archive = unzipSync(Buffer.from(result, 'base64'));
    const media = Object.keys(archive).filter(path => path.startsWith('ppt/media/') && path.endsWith('.png'));
    expect(media.length).toBeGreaterThan(0);
    expect(strFromU8(archive['ppt/slides/slide1.xml'])).toContain('<p:pic>');
    expect(strFromU8(archive['ppt/slides/slide2.xml'])).toContain('<p:pic>');
    expect(loader).toHaveBeenCalledOnce();
    expect(onWrite).toHaveBeenCalledWith(result);
    expect(PptxGenJS.prototype.writeFile).toBe(original);
  });
  it('keeps inline images working without a network request', async () => {
    const loader = vi.fn();
    const Presentation = createPresentationClass(PptxGenJS, loader, vi.fn());
    const pptx = new Presentation();
    pptx.addSlide().addImage({ data: PNG, x: 0, y: 0, w: 1, h: 1 });
    expect(await pptx.writeFile()).toBeTruthy();
    expect(loader).not.toHaveBeenCalled();
  });
  it('reports failed downloads instead of exporting a silently broken image', async () => {
    const onWrite = vi.fn();
    const Presentation = createPresentationClass(PptxGenJS, async () => { throw new Error('Image not found'); }, onWrite);
    const pptx = new Presentation();
    pptx.addSlide().addImage({ path: 'https://example.com/missing.png', x: 0, y: 0, w: 1, h: 1 });
    await expect(pptx.writeFile()).rejects.toThrow('Image not found');
    expect(onWrite).not.toHaveBeenCalled();
  });
});
