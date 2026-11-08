import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { TwinTransport } from '../dist/twins/transport.js';

test('download follows redirect and saves file', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/file' });
      res.end();
      return;
    }

    if (req.url === '/file') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('TEST_DOWNLOAD_OK');
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise(resolve =>
    server.listen(0, '127.0.0.1', resolve)
  );

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hermes-download-')
  );

  try {
    const address = server.address();
    const destination = path.join(directory, 'result.txt');
    const transport = new TwinTransport();

    const result = await transport.downloadToFile(
      `http://127.0.0.1:${address.port}/redirect`,
      destination
    );

    assert.equal(result.status, 200);
    assert.equal(result.bytes, 16);
    assert.equal(
      fs.readFileSync(destination, 'utf8'),
      'TEST_DOWNLOAD_OK'
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    await new Promise(resolve => server.close(resolve));
  }
});

test('cross-origin redirect removes sensitive headers', async () => {
  let receivedHeaders;

  const destinationServer = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('SAFE');
  });

  await new Promise(resolve =>
    destinationServer.listen(0, '127.0.0.1', resolve)
  );

  const destinationPort = destinationServer.address().port;

  const sourceServer = http.createServer((req, res) => {
    res.writeHead(302, {
      Location: `http://127.0.0.1:${destinationPort}/file`
    });
    res.end();
  });

  await new Promise(resolve =>
    sourceServer.listen(0, '127.0.0.1', resolve)
  );

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'hermes-redirect-security-')
  );

  try {
    const sourcePort = sourceServer.address().port;
    const transport = new TwinTransport();
    const destination = path.join(directory, 'result.txt');

    await transport.downloadToFile(
      `http://127.0.0.1:${sourcePort}/redirect`,
      destination,
      {
        headers: {
          Authorization: 'Bearer SECRET_TOKEN',
          Cookie: 'sessionid=SECRET_COOKIE',
          'X-IG-App-ID': 'SECRET_APP_ID',
          'X-Test-Safe': 'SAFE_HEADER'
        }
      }
    );

    assert.ok(receivedHeaders);
    assert.equal(receivedHeaders.authorization, undefined);
    assert.equal(receivedHeaders.cookie, undefined);
    assert.equal(receivedHeaders['x-ig-app-id'], undefined);
    assert.equal(receivedHeaders['x-test-safe'], 'SAFE_HEADER');
    assert.equal(fs.readFileSync(destination, 'utf8'), 'SAFE');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });

    await Promise.all([
      new Promise(resolve => sourceServer.close(resolve)),
      new Promise(resolve => destinationServer.close(resolve))
    ]);
  }
});
