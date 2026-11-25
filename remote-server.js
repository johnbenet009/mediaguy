const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.sqlite': 'application/octet-stream',
};

let server = null;
let wss = null;
let activePort = null;
let publicDir = '';
let accessPin = '';
let snapshot = {};
let broadcastTimer = null;
let heartbeatTimer = null;
let onCommand = () => {};
let onClientsChanged = () => {};
let onSignal = () => {};
let cameraInviteToken = '';
const failedPinAttempts = new Map();
const PIN_FAILURE_LIMIT = 5;
const PIN_FAILURE_WINDOW_MS = 5 * 60 * 1000;
const PIN_LOCKOUT_MS = 60 * 1000;

const normalizeAddress = (address) => String(address || '').replace(/^::ffff:/, '').split('%')[0];

const getPinLockout = (address, now = Date.now()) => {
    const attempt = failedPinAttempts.get(address);
    if (!attempt) return 0;
    if (attempt.blockedUntil > now) return attempt.blockedUntil - now;
    if (attempt.blockedUntil > 0) {
        failedPinAttempts.delete(address);
        return 0;
    }
    if (attempt.windowStartedAt + PIN_FAILURE_WINDOW_MS <= now) failedPinAttempts.delete(address);
    return 0;
};

const recordPinFailure = (address, now = Date.now()) => {
    const previous = failedPinAttempts.get(address);
    const attempt = !previous || previous.windowStartedAt + PIN_FAILURE_WINDOW_MS <= now
        ? { windowStartedAt: now, failures: 0, blockedUntil: 0 }
        : previous;
    attempt.failures += 1;
    if (attempt.failures >= PIN_FAILURE_LIMIT) attempt.blockedUntil = now + PIN_LOCKOUT_MS;
    failedPinAttempts.set(address, attempt);
    return Math.max(0, attempt.blockedUntil - now);
};

const sendSignal = (to, payload) => {
    if (!wss || typeof to !== 'string' || !payload || typeof payload !== 'object') return false;
    const target = [...wss.clients].find(client => client.clientId === to && client.authed && client.readyState === 1);
    if (!target) return false;
    if (target.cameraOnly) target.cameraAllowedPeers.add('host');
    sendJson(target, { type: 'signal', from: 'host', payload });
    return true;
};

const getLanUrls = (port) => {
    const interfaces = os.networkInterfaces();
    const urls = [];
    for (const [name, addresses] of Object.entries(interfaces)) {
        for (const address of addresses || []) {
            if (address.family === 'IPv4' && !address.internal) {
                urls.push({ interface: name, address: address.address, url: `http://${address.address}:${port}` });
            }
        }
    }
    return urls;
};

const authenticatedClients = () => {
    let count = 0;
    if (wss) for (const client of wss.clients) if (client.authed && client.readyState === 1) count += 1;
    return count;
};

const sendJson = (client, payload) => {
    if (client.readyState === 1) {
        try { client.send(JSON.stringify(payload)); } catch {}
    }
};

const broadcastState = () => {
    broadcastTimer = null;
    if (!wss) return;
    const message = JSON.stringify({ type: 'state', state: snapshot });
    for (const client of wss.clients) {
        if (client.authed && client.readyState === 1) {
            try { client.send(message); } catch {}
        }
    }
};

const publish = (partial) => {
    if (!partial || typeof partial !== 'object') return;
    snapshot = { ...snapshot, ...partial, serverTime: Date.now() };
    if (!broadcastTimer) broadcastTimer = setTimeout(broadcastState, 120);
};

const handleRequest = (request, response) => {
    try {
        const requestUrl = new URL(request.url, 'http://localhost');
        let pathname = decodeURIComponent(requestUrl.pathname);
        if (request.method === 'GET' && pathname === '/camera-invite.json') {
            if (!cameraInviteToken) {
                response.writeHead(503, { 'Cache-Control': 'no-store' });
                response.end('Camera invitation is unavailable');
                return;
            }
            response.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store',
            });
            response.end(JSON.stringify({ cameraToken: cameraInviteToken }));
            return;
        }
        if (pathname === '/') pathname = '/index.html';
        const filePath = path.normalize(path.join(publicDir, pathname));
        if (!filePath.startsWith(path.normalize(publicDir + path.sep)) && filePath !== path.normalize(publicDir)) {
            response.writeHead(403); response.end('Forbidden'); return;
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            response.writeHead(404); response.end('Not found'); return;
        }
        const ext = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(500); response.end('Server error');
    }
};

const listenOnPort = (preferredPort) => new Promise((resolve, reject) => {
    let attempt = 0;
    const tryListen = (port) => {
        server.once('error', (error) => {
            if (error.code === 'EADDRINUSE' && attempt < 20) {
                attempt += 1;
                server.removeAllListeners('error');
                tryListen(port + 1);
            } else {
                reject(error);
            }
        });
        server.listen(port, '0.0.0.0', () => {
            server.removeAllListeners('error');
            server.on('error', (error) => console.error('Remote server error:', error));
            resolve(port);
        });
    };
    tryListen(preferredPort);
});

const start = async ({ directory, port = 9174, pin = '' } = {}) => {
    if (server) return status();
    publicDir = directory;
    accessPin = typeof pin === 'string' && pin.trim() ? pin.trim() : String(crypto.randomInt(10000000, 100000000));
    cameraInviteToken = crypto.randomBytes(24).toString('base64url');
    failedPinAttempts.clear();
    server = http.createServer(handleRequest);
    activePort = await listenOnPort(Number(port) || 9174);

    wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 * 1024 });
    wss.on('connection', (client) => {
        client.clientId = require('crypto').randomUUID();
        const address = normalizeAddress(client._socket?.remoteAddress);
        client.remoteAddressKey = address;
        client.localClient = address === '127.0.0.1' || address === '::1';
        client.cameraOnly = false;
        client.cameraAllowedPeers = new Set();
        client.authed = !accessPin || client.localClient;
        client.alive = true;
        client.on('pong', () => { client.alive = true; });
        const retryAfterMs = client.localClient ? 0 : getPinLockout(client.remoteAddressKey);
        sendJson(client, { type: 'auth', required: Boolean(accessPin), ok: client.authed, retryAfterMs, clientId: client.clientId });
        if (client.authed) {
            sendJson(client, { type: 'state', state: snapshot });
            onClientsChanged(authenticatedClients());
        }
        client.on('message', (raw) => {
            let message;
            try { message = JSON.parse(raw.toString()); } catch { return; }
            if (message.type === 'hello') {
                client.cameraOnly = Boolean(cameraInviteToken && message.cameraToken === cameraInviteToken);
                const requestedCamera = message.role === 'camera' || (typeof message.cameraToken === 'string' && message.cameraToken.length > 0);
                if (requestedCamera && !client.cameraOnly) {
                    client.authed = false;
                    sendJson(client, { type: 'auth', required: true, ok: false, reason: 'invalid-camera-token', clientId: client.clientId });
                    onClientsChanged(authenticatedClients());
                    return;
                }
                const now = Date.now();
                const lockoutMs = !client.cameraOnly && !client.localClient ? getPinLockout(client.remoteAddressKey, now) : 0;
                if (lockoutMs > 0) {
                    sendJson(client, { type: 'auth', required: true, ok: false, pinRejected: true, retryAfterMs: lockoutMs, clientId: client.clientId });
                    client.close(4003, 'Too many PIN attempts');
                    return;
                }
                client.authed = !accessPin || client.localClient || message.pin === accessPin || client.cameraOnly;
                if (!client.authed && !client.localClient && !client.cameraOnly) {
                    const retryAfterMs = recordPinFailure(client.remoteAddressKey, now);
                    sendJson(client, { type: 'auth', required: true, ok: false, pinRejected: true, retryAfterMs, clientId: client.clientId });
                    if (retryAfterMs > 0) client.close(4003, 'Too many PIN attempts');
                    onClientsChanged(authenticatedClients());
                    return;
                }
                if (!client.cameraOnly && !client.localClient) failedPinAttempts.delete(client.remoteAddressKey);
                sendJson(client, { type: 'auth', required: Boolean(accessPin) && !client.cameraOnly, ok: client.authed, role: client.cameraOnly ? 'camera' : 'remote', clientId: client.clientId });
                sendJson(client, { type: 'state', state: snapshot });
                onClientsChanged(authenticatedClients());
                return;
            }
            if (message.type === 'command' && client.authed && !client.cameraOnly && message.command && typeof message.command.action === 'string') {
                onCommand(message.command);
            }
            if (message.type === 'signal' && client.authed && typeof message.to === 'string' && message.payload && typeof message.payload === 'object') {
                if (client.cameraOnly && message.to === 'host') {
                    if (['register', 'unregister', 'offer', 'candidate', 'video-frame', 'camera-message-ack', 'camera-message-reply', 'camera-operator-message'].includes(message.payload.type)) onSignal({ from: client.clientId, payload: message.payload });
                }
                else {
                    const target = [...wss.clients].find(peer => peer.clientId === message.to && peer.authed && peer.readyState === 1);
                    if (client.cameraOnly && !client.cameraAllowedPeers.has(message.to)) return;
                    if (target) {
                        if (target.cameraOnly && message.payload.type === 'connect') target.cameraAllowedPeers.add(client.clientId);
                        sendJson(target, { type: 'signal', from: client.clientId, payload: message.payload });
                    }
                }
            }
        });
        client.on('close', () => {
            if (client.cameraOnly) onSignal({ from: client.clientId, payload: { type: 'unregister' } });
            onClientsChanged(authenticatedClients());
        });
        client.on('error', () => {});
    });

    heartbeatTimer = setInterval(() => {
        if (!wss) return;
        for (const client of wss.clients) {
            if (!client.alive) { try { client.terminate(); } catch {} continue; }
            client.alive = false;
            try { client.ping(); } catch {}
        }
    }, 30000);

    return status();
};

const stop = () => {
    if (broadcastTimer) { clearTimeout(broadcastTimer); broadcastTimer = null; }
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (wss) {
        for (const client of wss.clients) { try { client.terminate(); } catch {} }
        try { wss.close(); } catch {}
        wss = null;
    }
    if (server) {
        try { server.close(); } catch {}
        server = null;
    }
    activePort = null;
    cameraInviteToken = '';
    failedPinAttempts.clear();
    snapshot = {};
    onClientsChanged(0);
    return status();
};

const setPin = (pin) => {
    const cleanPin = typeof pin === 'string' ? pin.trim() : '';
    if (!cleanPin) return status();
    accessPin = cleanPin;
    failedPinAttempts.clear();
    if (wss) {
        for (const client of wss.clients) {
            if (!accessPin || client.cameraOnly || client.localClient) {
                client.authed = true;
                sendJson(client, { type: 'auth', required: Boolean(accessPin) && !client.cameraOnly && !client.localClient, ok: true, role: client.cameraOnly ? 'camera' : 'remote', clientId: client.clientId });
                sendJson(client, { type: 'state', state: snapshot });
            } else if (client.authed) {
                client.authed = false;
                sendJson(client, { type: 'auth', required: true, ok: false });
            }
        }
        onClientsChanged(authenticatedClients());
    }
    return status();
};

const status = () => ({
    running: Boolean(server),
    port: activePort,
    urls: activePort ? getLanUrls(activePort) : [],
    clients: authenticatedClients(),
    pinEnabled: Boolean(accessPin),
    accessPin,
    lanUrls: activePort ? getLanUrls(activePort) : [],
    authenticatedClients: authenticatedClients(),
    hasPin: Boolean(accessPin),
    cameraInviteToken,
});

module.exports = {
    start,
    stop,
    status,
    publish,
    sendSignal,
    setPin,
    setHandlers: (handlers) => {
        if (handlers.onCommand) onCommand = handlers.onCommand;
        if (handlers.onClientsChanged) onClientsChanged = handlers.onClientsChanged;
        if (handlers.onSignal) onSignal = handlers.onSignal;
    },
    onCommand: (cb) => { onCommand = cb; },
    onClientsChanged: (cb) => { onClientsChanged = cb; },
    onSignal: (cb) => { onSignal = cb; },
};
