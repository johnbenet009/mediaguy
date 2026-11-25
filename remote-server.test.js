const assert = require('node:assert/strict');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const WebSocket = require('ws');
const remoteServer = require('./remote-server');

const findAvailablePort = async () => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const { port } = probe.address();
    await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
    return port;
};

const getRemoteTestHost = () => Object.values(os.networkInterfaces())
    .flatMap(addresses => addresses || [])
    .find(address => address.family === 'IPv4' && !address.internal)?.address;

const connect = async url => {
    const socket = new WebSocket(url);
    const messages = [];
    const waiters = [];
    socket.on('message', raw => {
        const message = JSON.parse(raw.toString());
        const waiter = waiters.shift();
        if (waiter) waiter(message);
        else messages.push(message);
    });
    await once(socket, 'open');
    return {
        socket,
        nextMessage: () => messages.length
            ? Promise.resolve(messages.shift())
            : new Promise(resolve => waiters.push(resolve)),
    };
};

const remoteTestHost = getRemoteTestHost();

test('remote server generates a default PIN and enforces remote and camera roles', { skip: !remoteTestHost && 'requires a non-loopback IPv4 interface' }, async t => {
    const port = await findAvailablePort();
    const commands = [];
    const cameraSignals = [];
    let resolveCommand;
    let resolveFrame;
    let resolveOperatorMessage;
    const commandReceived = new Promise(resolve => { resolveCommand = resolve; });
    const frameReceived = new Promise(resolve => { resolveFrame = resolve; });
    const operatorMessageReceived = new Promise(resolve => { resolveOperatorMessage = resolve; });
    remoteServer.setHandlers({
        onCommand: command => {
            commands.push(command);
            resolveCommand(command);
        },
        onSignal: signal => {
            cameraSignals.push(signal);
            if (signal.payload.type === 'video-frame') resolveFrame(signal);
            if (signal.payload.type === 'camera-operator-message') resolveOperatorMessage(signal);
        },
    });
    const status = await remoteServer.start({
        directory: path.join(__dirname, 'public'),
        port,
    });
    t.after(() => {
        remoteServer.stop();
        remoteServer.setHandlers({ onCommand: () => {} });
    });

    assert.match(status.accessPin, /^\d{8}$/);
    assert.equal(status.pinEnabled, true);
    assert.equal(remoteServer.setPin('').accessPin, status.accessPin);

    const inviteResponse = await fetch(`http://${remoteTestHost}:${port}/camera-invite.json`);
    assert.equal(inviteResponse.status, 200);
    assert.equal(inviteResponse.headers.get('cache-control'), 'no-store');
    const inviteData = await inviteResponse.json();
    assert.equal(inviteData.cameraToken, status.cameraInviteToken);
    assert.equal('accessPin' in inviteData, false);

    const invalidCamera = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => invalidCamera.socket.close());
    await invalidCamera.nextMessage();
    invalidCamera.socket.send(JSON.stringify({ type: 'hello', role: 'camera', cameraToken: 'stale-camera-token' }));
    const invalidCameraAuth = await invalidCamera.nextMessage();
    assert.equal(invalidCameraAuth.ok, false);
    assert.equal(invalidCameraAuth.reason, 'invalid-camera-token');
    assert.equal(invalidCameraAuth.pinRejected, undefined);

    const remote = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => remote.socket.close());
    const initialAuth = await remote.nextMessage();
    assert.equal(initialAuth.type, 'auth');
    assert.equal(initialAuth.ok, false);
    assert.equal(initialAuth.pinRejected, undefined);

    remote.socket.send(JSON.stringify({ type: 'hello', pin: '00000000' }));
    const rejectedAuth = await remote.nextMessage();
    assert.equal(rejectedAuth.type, 'auth');
    assert.equal(rejectedAuth.ok, false);
    assert.equal(rejectedAuth.pinRejected, true);
    remote.socket.send(JSON.stringify({ type: 'command', command: { scope: 'timer', action: 'start' } }));
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.deepEqual(commands, []);

    remote.socket.send(JSON.stringify({ type: 'hello', pin: status.accessPin }));
    const acceptedAuth = await remote.nextMessage();
    assert.equal(acceptedAuth.type, 'auth');
    assert.equal(acceptedAuth.ok, true);
    remote.socket.send(JSON.stringify({ type: 'command', command: { scope: 'timer', action: 'start' } }));
    assert.deepEqual(await commandReceived, { scope: 'timer', action: 'start' });

    const attacker = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => attacker.socket.close());
    await attacker.nextMessage();
    for (let attempt = 0; attempt < 5; attempt += 1) {
        attacker.socket.send(JSON.stringify({ type: 'hello', pin: 'wrong-pin' }));
        const rejected = await attacker.nextMessage();
        assert.equal(rejected.type, 'auth');
        assert.equal(rejected.ok, false);
        assert.equal(rejected.pinRejected, true);
        if (attempt === 4) assert.ok(rejected.retryAfterMs > 0);
    }
    await once(attacker.socket, 'close');

    const blockedRemote = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => blockedRemote.socket.close());
    await blockedRemote.nextMessage();
    const lockoutClosed = once(blockedRemote.socket, 'close');
    blockedRemote.socket.send(JSON.stringify({ type: 'hello', pin: status.accessPin }));
    const lockoutAuth = await blockedRemote.nextMessage();
    assert.equal(lockoutAuth.ok, false);
    assert.ok(lockoutAuth.retryAfterMs > 0);
    await lockoutClosed;

    const replacementPin = 'replacement-access-pin';
    assert.equal(remoteServer.setPin(replacementPin).accessPin, replacementPin);
    const recoveredRemote = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => recoveredRemote.socket.close());
    await recoveredRemote.nextMessage();
    recoveredRemote.socket.send(JSON.stringify({ type: 'hello', pin: replacementPin }));
    const recoveredAuth = await recoveredRemote.nextMessage();
    assert.equal(recoveredAuth.ok, true);

    const camera = await connect(`ws://${remoteTestHost}:${port}/ws`);
    t.after(() => camera.socket.close());
    await camera.nextMessage();
    camera.socket.send(JSON.stringify({ type: 'hello', cameraToken: status.cameraInviteToken }));
    const cameraAuth = await camera.nextMessage();
    assert.equal(cameraAuth.type, 'auth');
    assert.equal(cameraAuth.ok, true);
    assert.equal(cameraAuth.role, 'camera');
    camera.socket.send(JSON.stringify({ type: 'signal', to: 'host', payload: { type: 'video-frame', frame: 'sample-frame' } }));
    const frameSignal = await frameReceived;
    assert.equal(frameSignal.payload.frame, 'sample-frame');
    camera.socket.send(JSON.stringify({ type: 'signal', to: 'host', payload: { type: 'camera-operator-message', id: 'phone-message-1', text: 'Ready to go live' } }));
    const operatorMessage = await operatorMessageReceived;
    assert.equal(operatorMessage.payload.text, 'Ready to go live');
    assert.equal(cameraSignals.length, 2);
    camera.socket.send(JSON.stringify({ type: 'command', command: { scope: 'timer', action: 'stop' } }));
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(commands.length, 1);
});