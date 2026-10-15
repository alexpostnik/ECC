'use strict';

// Chromium restricts its debugger to loopback. Expose it only on this private
// Compose network; the service has no published host ports or shared secrets.
const http = require('node:http');
const net = require('node:net');
const upstream = { hostname: '127.0.0.1', port: 9223 };

const server = http.createServer((request, response) => {
  const forwarded = http.request({
    ...upstream,
    method: request.method,
    path: request.url,
    headers: { ...request.headers, host: '127.0.0.1:9223' },
  }, incoming => {
    const chunks = [];
    let bytes = 0;
    incoming.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) {
        incoming.destroy();
        response.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    incoming.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8')
        .replaceAll('ws://127.0.0.1:9223/', 'ws://browser:9222/');
      const headers = { ...incoming.headers, 'content-length': Buffer.byteLength(body) };
      delete headers['transfer-encoding'];
      response.writeHead(incoming.statusCode, headers);
      response.end(body);
    });
    incoming.on('error', () => response.destroy());
  });
  forwarded.on('error', () => {
    response.writeHead(502);
    response.end('Chromium debugger is not ready');
  });
  request.pipe(forwarded);
});

server.on('upgrade', (request, socket, head) => {
  const target = net.connect(upstream.port, upstream.hostname, () => {
    const headers = { ...request.headers, host: '127.0.0.1:9223' };
    target.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`
      + Object.entries(headers).map(([name, value]) => `${name}: ${value}\r\n`).join('')
      + '\r\n');
    if (head.length) target.write(head);
    socket.pipe(target).pipe(socket);
  });
  target.on('error', () => socket.destroy());
  socket.on('error', () => target.destroy());
  socket.on('close', () => target.destroy());
  target.on('close', () => socket.destroy());
});

server.listen(9222, '0.0.0.0');
