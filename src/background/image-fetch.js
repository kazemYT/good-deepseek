/** Fetch raster images with extension host permissions, not sandbox CORS. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fetchPresentationImage(rawUrl) {
  const url = new URL(rawUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Only public HTTP(S) image URLs are supported.');
  }
  const response = await fetch(url.href, {
    credentials: 'omit', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Image download failed (${response.status}).`);
  const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!['image/png', 'image/jpeg', 'image/gif'].includes(mime)) {
    throw new Error('Use a direct PNG, JPEG or GIF image URL.');
  }
  if (Number(response.headers.get('content-length')) > MAX_IMAGE_BYTES) throw new Error('Image is too large (10 MB maximum).');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error('Image is too large (10 MB maximum).');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  if (!size) throw new Error('Empty image.');
  let binary = '';
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 8192) binary += String.fromCharCode(...chunk.subarray(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
