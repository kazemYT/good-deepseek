import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPresentationImage, MAX_IMAGE_BYTES } from './image-fetch.js';

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => vi.unstubAllGlobals());
describe('presentation image download', () => {
  it('returns embeddable base64 and omits credentials', async () => {
    fetch.mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
    expect(await fetchPresentationImage('https://example.com/a.png')).toBe('data:image/png;base64,iVBORw==');
    expect(fetch).toHaveBeenCalledWith('https://example.com/a.png', expect.objectContaining({ credentials: 'omit' }));
  });
  it.each(['file:///etc/passwd', 'data:image/png;base64,eA==', 'https://user:pass@example.com/a.png'])('rejects unsupported URL %s', async url => {
    await expect(fetchPresentationImage(url)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects HTML masquerading as an image', async () => {
    fetch.mockResolvedValue(new Response('<html>challenge</html>', { headers: { 'Content-Type': 'text/html' } }));
    await expect(fetchPresentationImage('https://example.com/a')).rejects.toThrow('direct PNG');
  });
  it('rejects oversize images by header and by streamed body', async () => {
    fetch.mockResolvedValueOnce(new Response('big', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(MAX_IMAGE_BYTES + 1) } }));
    await expect(fetchPresentationImage('https://example.com/a')).rejects.toThrow('too large');
    fetch.mockResolvedValueOnce(new Response(new Uint8Array(MAX_IMAGE_BYTES + 1), { headers: { 'Content-Type': 'image/png' } }));
    await expect(fetchPresentationImage('https://example.com/a')).rejects.toThrow('too large');
  });
  it('reports server errors and empty images', async () => {
    fetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(fetchPresentationImage('https://example.com/a')).rejects.toThrow('404');
    fetch.mockResolvedValueOnce(new Response('', { headers: { 'Content-Type': 'image/png' } }));
    await expect(fetchPresentationImage('https://example.com/a')).rejects.toThrow('Empty');
  });
});
