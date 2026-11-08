import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { TwinTransport } from '../dist/twins/transport.js';

test('local HTTP server returns 429 with Retry-After', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(429, {
      'Retry-After': '30',
      'Content-Type': 'text/plain'
    });
    res.end('Rate limited');
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    const transport = new TwinTransport();

    const response = await transport.requestBuffer(
      `http://127.0.0.1:${address.port}/test`
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers['retry-after'], '30');
    assert.equal(response.data.toString(), 'Rate limited');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
