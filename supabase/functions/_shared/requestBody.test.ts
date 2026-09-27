import { describe, expect, it, jest } from '@jest/globals';

import { readJsonBodyWithLimit } from './requestBody';

function makeRequest(
  chunks: string[],
  contentLength?: string,
  onRead = jest.fn(),
): Request {
  const encoder = new TextEncoder();
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      onRead();
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(chunk));
      }
    },
  });
  return {
    body,
    headers: new Headers(
      contentLength === undefined ? {} : { 'content-length': contentLength },
    ),
  } as Request;
}

describe('bounded JSON request reader', () => {
  it('rejects a chunked body as soon as it crosses the byte limit', async () => {
    await expect(readJsonBodyWithLimit(
      makeRequest(['{"value":"', '123456', '"}']),
      12,
    )).resolves.toEqual({ ok: false, reason: 'too_large' });
  });

  it('accepts valid JSON exactly at the byte limit', async () => {
    const json = '{"ok":true}';
    await expect(readJsonBodyWithLimit(
      makeRequest(['{"ok":', 'true}']),
      new TextEncoder().encode(json).byteLength,
    )).resolves.toEqual({ ok: true, value: { ok: true } });
  });

  it('counts UTF-8 bytes rather than JavaScript characters', async () => {
    const json = '{"text":"ế"}';
    expect(json.length).toBeLessThan(new TextEncoder().encode(json).byteLength);

    await expect(readJsonBodyWithLimit(
      makeRequest([json]),
      json.length,
    )).resolves.toEqual({ ok: false, reason: 'too_large' });
  });

  it('uses Content-Length only for an immediate oversized rejection', async () => {
    const getReader = jest.fn();
    const request = {
      body: { getReader },
      headers: new Headers({ 'content-length': '100' }),
    } as unknown as Request;

    await expect(readJsonBodyWithLimit(request, 10)).resolves.toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(getReader).not.toHaveBeenCalled();
  });

  it('does not let a malformed Content-Length bypass streamed enforcement', async () => {
    await expect(readJsonBodyWithLimit(
      makeRequest(['{"value":"too large"}'], '-1'),
      8,
    )).resolves.toEqual({ ok: false, reason: 'too_large' });
  });

  it('returns a controlled error for malformed JSON', async () => {
    await expect(readJsonBodyWithLimit(
      makeRequest(['{"broken"']),
      100,
    )).resolves.toEqual({ ok: false, reason: 'invalid_json' });
  });
});
