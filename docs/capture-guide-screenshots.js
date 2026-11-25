const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require('puppeteer-core');
const remoteServer = require('../remote-server');

const root = path.resolve(__dirname, '..');
const publicDirectory = path.join(root, 'public');
const screenshotDirectory = path.join(__dirname, 'screenshots');
const guideAssetsDirectory = path.join(root, 'vite-core', 'public', 'guide');
const chromePath = [
	process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
	process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
	process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
].find(candidate => candidate && fs.existsSync(candidate));
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

if (!chromePath) throw new Error('Google Chrome was not found. Install Chrome to capture guide screenshots.');
fs.mkdirSync(screenshotDirectory, { recursive: true });
fs.mkdirSync(guideAssetsDirectory, { recursive: true });

const capture = async () => {
	const remoteStatus = await remoteServer.start({ directory: publicDirectory, port: 9174 });

	const browser = await puppeteer.launch({
		executablePath: chromePath,
		headless: true,
		userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mediaguy-help-')),
		args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'],
	});
	try {
		const page = await browser.newPage();
		page.on('console', message => console.log(`Chrome ${message.type()}: ${message.text()}`));
		page.on('pageerror', error => console.error(`App page error: ${error.message}`));
		await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
		await page.evaluateOnNewDocument(() => {
			if (location.protocol === 'file:') localStorage.setItem('projectDisplay', '2');
			window.electronAPI = {
				checkInternetConnection: async () => ({ online: true, checkedAt: Date.now(), checks: [] }),
				getCopilotTokenStatus: async () => ({ configured: true, encryptionAvailable: true }),
				getDisplays: async () => [{ id: 2, label: 'Presentation display', isPrimary: false, isUsedByMainTimer: false }],
				requestStartupDisplay: async () => null,
				onDisplaysChanged: () => () => undefined,
				onBibleProjectionClosed: () => () => undefined,
				onSpeechRecognitionEvent: () => () => undefined,
				onRemoteCommand: () => () => undefined,
				dbGet: async () => null,
				dbSet: async () => ({ ok: true }),
				remotePublish: () => undefined,
			};
		});
		await page.goto(pathToFileURL(path.join(publicDirectory, 'index.html')).href);
		try {
			await page.waitForSelector('button[aria-label="Timer, draggable navigation tab"]', { timeout: 15000 });
		} catch (error) {
			console.error('App content did not load:', (await page.locator('body').innerText()).slice(0, 1000));
			throw error;
		}

		const screenshots = [
			{ file: 'timer-dashboard.png', tab: 'Timer, draggable navigation tab' },
			{ file: 'transcribe.png', tab: 'Transcribe, draggable navigation tab' },
			{ file: 'bible.png', tab: 'Bible/Songs, draggable navigation tab' },
			{ file: 'cameras.png', tab: 'Cameras, draggable navigation tab' },
		];
		for (const screenshot of screenshots) {
			await page.locator(`button[aria-label="${screenshot.tab}"]`).click();
			await pause(500);
			await page.screenshot({ path: path.join(screenshotDirectory, screenshot.file) });
		}

		const mobilePage = await browser.newPage();
		await mobilePage.setViewport({ width: 430, height: 932, deviceScaleFactor: 1 });
		mobilePage.on('console', message => console.log(`Remote Chrome ${message.type()}: ${message.text()}`));
		mobilePage.on('pageerror', error => console.error(`Remote page error: ${error.message}`));
		await mobilePage.evaluateOnNewDocument(() => {
			const reference = { book: 'John', chapter: 3, verse: 16, label: 'John 3:16' };
			class ScreenshotSocket {
				static CONNECTING = 0;
				static OPEN = 1;
				static CLOSING = 2;
				static CLOSED = 3;
				readyState = ScreenshotSocket.CONNECTING;
				onopen = null;
				onmessage = null;
				onclose = null;
				onerror = null;
				constructor() {
					setTimeout(() => {
						this.readyState = ScreenshotSocket.OPEN;
						this.onopen?.({ target: this });
						this.onmessage?.({ data: JSON.stringify({ type: 'auth', required: false, ok: true, role: 'remote', clientId: 'guide-screenshot' }), target: this });
						this.onmessage?.({ data: JSON.stringify({ type: 'state', state: { serverTime: Date.now(), transcribe: { transcript: 'The Lord is my shepherd; I shall not want.', interim: '', isListening: true, status: 'Listening', bibleReference: reference }, bible: { books: [], bookId: 43, chapter: 3, verse: 16, presented: '', isShowing: false } } }), target: this });
					}, 25);
				}
				send() {}
				close() { this.readyState = ScreenshotSocket.CLOSED; this.onclose?.({ target: this }); }
			}
			window.WebSocket = ScreenshotSocket;
		});
		await mobilePage.goto(`http://127.0.0.1:${remoteStatus.port}/#/remote/bible/control`);
		let remoteCueCaptured = false;
		try {
			await mobilePage.waitForFunction(() => document.body.innerText.toLowerCase().includes('scripture heard'), { timeout: 15000 });
			await pause(500);
			await mobilePage.screenshot({ path: path.join(screenshotDirectory, 'remote-bible-cue.png'), fullPage: true });
			remoteCueCaptured = true;
		} catch {
			console.error('Remote cue did not render:', (await mobilePage.evaluate(() => document.body.innerText)).slice(0, 1800));
			await mobilePage.screenshot({ path: path.join(screenshotDirectory, 'remote-bible-cue-debug.png'), fullPage: true });
		}
		await mobilePage.close();

		for (const screenshot of [...screenshots, ...(remoteCueCaptured ? [{ file: 'remote-bible-cue.png' }] : [])]) {
			fs.copyFileSync(path.join(screenshotDirectory, screenshot.file), path.join(guideAssetsDirectory, screenshot.file));
		}
	} finally {
		await browser.close();
		await remoteServer.stop();
	}
};

capture().catch(error => {
	console.error(error);
	process.exitCode = 1;
});