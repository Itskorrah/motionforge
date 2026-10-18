#!/usr/bin/env node
/**
 * Deterministic headless video renderer. Dependencies: Node 22+, Chrome/Chromium, FFmpeg.
 * No npm dependencies or external services.
 *
 * Browser paints frame N at exact virtual time N/fps; CDP captures the viewport
 * as PNG, then FFmpeg turns numbered PNGs into an H.264 MP4.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTimeline } from './timeline.mjs';
import { synthesizeWav } from './sound.mjs';
import { loadProject } from './studio/project.mjs';

const DEFAULT_SCENE = fileURLToPath(new URL('./scene.html', import.meta.url));
const SPRING_SOURCE = fileURLToPath(new URL('./physics.cjs', import.meta.url));
const HELP = `Headless Render Engine — Chrome CDP → PNG frames → FFmpeg MP4

Usage:
  node render.mjs [options]

Options:
  --out PATH          Output MP4 (default: ./render.mp4)
  --project PATH      Validated MotionForge project.json (studio scene requires this)
  --scene PATH        Local HTML with window.renderFrame({frame,fps,width,height,duration,seed})
  --width N           Video width, even integer (default: 1280)
  --height N          Video height, even integer (default: 720)
  --fps N             Frames per second (default: 30)
  --seconds N         Duration in seconds (default: 8)
  --frames N          Exact frame count; overrides --seconds
  --seed N            Scene seed (default: 7)
  --tuning PATH       Per-scene spring/staging adjustments as JSON
  --bpm N             Tempo (default: 120; must align exactly with FPS)
  --beats-per-cut N   Beat-locked edit interval (default: 4 beats)
  --keep-wav          Save synthesised uncompressed soundtrack next to MP4
  --chrome PATH       Override Chrome/Chromium executable
  --ffmpeg PATH       Override FFmpeg executable (default: ffmpeg)
  --keep-frames       Save PNG frames beside output in <name>-frames/
  --no-sandbox        Chrome flag for restricted CI/containers only
  --help              Show this help

Example:
  node render.mjs --seconds 4 --fps 24 --width 1920 --height 1080 --out demo.mp4
`;

function getArgs(argv) {
  const defaults = { out: 'render.mp4', scene: DEFAULT_SCENE, width: 1280, height: 720, fps: 30, seconds: 8, seed: 7, bpm: 120, beatsPerCut: 4, ffmpeg: 'ffmpeg', keepFrames: false, keepWav: false, noSandbox: false };
  const a = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (key === '--help' || key === '-h') { console.log(HELP); process.exit(0); }
    if (key === '--keep-frames') { a.keepFrames = true; continue; }
    if (key === '--keep-wav') { a.keepWav = true; continue; }
    if (key === '--no-sandbox') { a.noSandbox = true; continue; }
    const name = { '--out':'out', '--project':'projectPath', '--scene':'scene', '--width':'width', '--height':'height', '--fps':'fps', '--seconds':'seconds', '--frames':'frames', '--seed':'seed', '--tuning':'tuning', '--bpm':'bpm', '--beats-per-cut':'beatsPerCut', '--chrome':'chrome', '--ffmpeg':'ffmpeg' }[key];
    if (!name) throw new Error(`Unknown argument: ${key}\n\n${HELP}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value after ${key}`);
    a[name] = ['width','height','fps','seconds','frames','seed','bpm','beatsPerCut'].includes(name) ? Number(value) : value;
  }
  for (const k of ['width','height','fps','seconds']) {
    if (!Number.isFinite(a[k]) || a[k] <= 0) throw new Error(`${k} must be a positive number`);
  }
  for (const k of ['width','height']) {
    if (!Number.isInteger(a[k]) || a[k] % 2 !== 0) throw new Error(`${k} must be an even integer (H.264 yuv420p)`);
  }
  if (!Number.isInteger(a.fps) || a.fps > 120) throw new Error('fps must be an integer between 1 and 120');
  if (!Number.isInteger(a.seed) || a.seed < 0) throw new Error('seed must be a non-negative integer');
  if (a.frames !== undefined && (!Number.isSafeInteger(a.frames) || a.frames < 1)) throw new Error('frames must be a positive integer');
  a.frames = a.frames ?? Math.round(a.seconds * a.fps);
  if (a.frames < 1) throw new Error('Not enough frames for that duration');
  if (a.frames > 100000) throw new Error('Requested more than 100,000 frames');
  a.seconds = a.frames / a.fps;
  a.timeline = createTimeline(a);
  a.tuning = a.tuning ? JSON.parse(requireTuning(a.tuning)) : { shots: {} };
  a.project = a.projectPath ? JSON.parse(requireTuning(a.projectPath)) : null;
  a.out = resolve(a.out);
  a.scene = resolve(a.scene);
  if (extname(a.out).toLowerCase() !== '.mp4') throw new Error('--out must end in .mp4');
  if (!existsSync(a.scene)) throw new Error(`Scene does not exist: ${a.scene}`);
  return a;
}

function requireTuning(path) {
  try { return readFileSync(resolve(path), 'utf8'); }
  catch { throw new Error(`Cannot read tuning file: ${path}`); }
}

function which(executable) {
  if (isAbsolute(executable) && existsSync(executable)) return executable;
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, [executable], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim().split(/\r?\n/)[0] : null;
}

function locateChrome(override) {
  if (override) {
    const found = which(override);
    if (!found) throw new Error(`Chrome not found: ${override}`);
    return found;
  }
  const candidates = [
    process.env.CHROME_PATH,
    ...(process.platform === 'win32' ? [
      join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
      join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    ] : []),
    ...(process.platform === 'darwin' ? [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ] : []),
    'google-chrome-stable','google-chrome','chromium','chromium-browser',
  ].filter(Boolean);
  for (const c of candidates) { const path = which(c); if (path) return path; }
  throw new Error('Chrome/Chromium not found. Install Chrome, or pass --chrome PATH.');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function bootChrome(executable, args, profile) {
  const flags = [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${args.width},${args.height}`,
    'about:blank',
  ];
  if (args.noSandbox || (typeof process.getuid === 'function' && process.getuid() === 0)) flags.unshift('--no-sandbox');
  const browser = spawn(executable, flags, { stdio: ['ignore','ignore','pipe'] });
  let errorText = '';
  browser.stderr.on('data', b => { errorText = (errorText + b.toString()).slice(-6000); });
  browser.on('error', err => { errorText += '\n' + err.message; });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 120; i++) {
    if (browser.exitCode !== null) break;
    try {
      const [port] = (await readFile(portFile, 'utf8')).trim().split('\n');
      if (/^\d+$/.test(port)) return { browser, port: Number(port) };
    } catch { /* port not ready */ }
    await delay(100);
  }
  browser.kill();
  throw new Error(`Chrome did not start. Try --no-sandbox in CI.\n${errorText}`);
}

class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener('message', ({data}) => {
      let reply;
      try { reply = JSON.parse(data); } catch { return; }
      if (!reply.id) return;
      const task = this.pending.get(reply.id);
      if (!task) return;
      this.pending.delete(reply.id);
      clearTimeout(task.timer);
      if (reply.error) task.reject(new Error(`CDP ${task.method}: ${reply.error.message}`));
      else task.resolve(reply.result);
    });
    socket.addEventListener('close', () => this.failAll(new Error('Chrome DevTools connection closed')));
    socket.addEventListener('error', () => this.failAll(new Error('Chrome DevTools connection errored')));
  }
  failAll(error) {
    for (const task of this.pending.values()) { clearTimeout(task.timer); task.reject(error); }
    this.pending.clear();
  }
  send(method, params = {}) {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error('CDP socket is not open');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP ${method} timed out`)); }, 30000);
      this.pending.set(id, { resolve, reject, method, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(`Scene error: ${result.exceptionDetails.text}\n${result.exceptionDetails.exception?.description ?? ''}`);
    return result.result?.value;
  }
  close() { this.socket.close(); this.failAll(new Error('CDP closed')); }
}

async function connectPage(port) {
  for (let retry = 0; retry < 50; retry++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(String(response.status));
      const pages = await response.json();
      const page = pages.find(t => t.type === 'page');
      if (!page) throw new Error('No page target');
      // Use the localhost origin advertised by Chrome itself, never a public port.
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((res, rej) => {
        const timeout = setTimeout(() => rej(new Error('CDP WebSocket timed out')), 10000);
        ws.addEventListener('open', () => { clearTimeout(timeout); res(); }, { once: true });
        ws.addEventListener('error', () => { clearTimeout(timeout); rej(new Error('CDP WebSocket failed')); }, { once: true });
      });
      return new CDP(ws);
    } catch (error) {
      if (retry === 49) throw error;
      await delay(100);
    }
  }
}

async function waitForScene(cdp) {
  for (let i = 0; i < 100; i++) {
    if (await cdp.evaluate('document.readyState === "complete" && typeof window.renderFrame === "function"')) {
      await cdp.evaluate('document.fonts.ready.then(() => true)');
      return;
    }
    await delay(100);
  }
  throw new Error('Scene did not expose window.renderFrame within 10 seconds: ' + JSON.stringify(await cdp.evaluate('({ url: location.href, state: document.readyState, scripts: document.scripts.length, title: document.title, body: document.body?.innerText?.slice(0,80) })')));
}

async function encode(ffmpeg, framesDir, fps, audioPath, seconds, output) {
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps),
    '-start_number', '0', '-i', join(framesDir, 'frame-%06d.png'),
    '-i', audioPath, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-ar', '48000', '-t', String(seconds),
    '-movflags', '+faststart', output,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, args, { stdio: ['ignore','ignore','pipe'] });
    let errors = '';
    p.stderr.on('data', b => { errors = (errors + b.toString()).slice(-12000); });
    p.on('error', err => reject(new Error(`Cannot run FFmpeg (${ffmpeg}): ${err.message}`)));
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${errors}`)));
  });
}

async function main() {
  const a = getArgs(process.argv.slice(2));
  if (a.project) {
    const validated = await loadProject(a.projectPath);
    if (a.frames !== validated.frames || a.fps !== a.project.fps || a.bpm !== a.project.bpm || a.beatsPerCut !== a.project.beatsPerCut)
      throw new Error('Render timing must exactly match project.json; run through studio.mjs');
  }
  const chromePath = locateChrome(a.chrome);
  const profile = await mkdtemp(join(tmpdir(), 'headless-chrome-'));
  const framesDir = a.keepFrames
    ? join(dirname(a.out), basename(a.out, '.mp4') + '-frames')
    : await mkdtemp(join(tmpdir(), 'headless-render-frames-'));
  const audioPath = a.keepWav ? a.out.replace(/\.mp4$/i,'.wav') : join(profile,'score.wav');
  let browser, cdp;
  try {
    await mkdir(dirname(a.out), { recursive: true });
    if (a.keepFrames && existsSync(framesDir)) throw new Error(`Frame folder already exists: ${framesDir} (remove it first)`);
    await mkdir(framesDir, { recursive: true });
    console.log(`Chrome: ${chromePath}`);
    console.log(`Rendering ${a.frames} frames at ${a.width}×${a.height} / ${a.fps} fps (${a.seconds.toFixed(3)}s)`);
    console.log(`${a.bpm} BPM, ${a.timeline.framesPerBeat} frames/beat, cut every ${a.beatsPerCut} beats (${a.timeline.cuts.length} shots)`);
    const audio = await synthesizeWav(audioPath, a.timeline, a.seed);
    console.log(`Synthesised stereo PCM: ${audio.samples} samples/channel at 48 kHz (peak ${audio.peak.toFixed(3)})`);
    const launched = await bootChrome(chromePath, a, profile);
    browser = launched.browser;
    cdp = await connectPage(launched.port);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: a.width, height: a.height, deviceScaleFactor: 1, mobile: false,
    });
    // Inject the self-contained HTML into about:blank. This also works where
    // managed Chrome policies block both file:// and localhost navigation.
    let html = await readFile(a.scene, 'utf8');
    if (html.includes('<!-- ENGINE_SPRING_SOURCE -->')) {
      const physics = await readFile(SPRING_SOURCE, 'utf8');
      html = html.replace('<!-- ENGINE_SPRING_SOURCE -->', `<script>${physics}</script>`);
    }
    await cdp.evaluate(`document.open(); document.write(${JSON.stringify(html)}); document.close(); true`);
    await waitForScene(cdp);
    for (let frame = 0; frame < a.frames; frame++) {
      const sceneInput = JSON.stringify({ frame, fps: a.fps, width: a.width, height: a.height, duration: a.seconds, seed: a.seed, bpm: a.bpm, beatsPerCut: a.beatsPerCut, framesPerBeat: a.timeline.framesPerBeat, tuning: a.tuning, project: a.project });
      const report = await cdp.evaluate(`window.renderFrame(${sceneInput})`);
      if (a.scene === DEFAULT_SCENE && (!report || report.cutIndex !== Math.floor(frame / a.timeline.cutInterval) ||
          report.beatIndex !== Math.floor(frame / a.timeline.framesPerBeat))) {
        throw new Error(`Scene timeline drift at frame ${frame}: ${JSON.stringify(report)}`);
      }
      // Capture Chrome's composited viewport *after* the scene paints. No sleeps
      // or animation timer: each frame is controlled by an exact frame index.
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
      await writeFile(join(framesDir, `frame-${String(frame).padStart(6,'0')}.png`), Buffer.from(shot.data, 'base64'));
      if ((frame+1) % Math.max(1, Math.floor(a.frames / 10)) === 0 || frame === a.frames - 1) {
        process.stdout.write(`\rCaptured ${frame+1}/${a.frames} frames`);
      }
    }
    console.log('\nEncoding H.264 + AAC MP4 with FFmpeg…');
    await encode(a.ffmpeg, framesDir, a.fps, audioPath, a.seconds, a.out);
    console.log(`Done: ${a.out}`);
    if (a.keepFrames) console.log(`PNG frames: ${framesDir}`);
    if (a.keepWav) console.log(`Synthesised WAV: ${audioPath}`);
  } finally {
    try { cdp?.close(); } catch { /* ignore */ }
    if (browser && browser.exitCode === null) browser.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    // Never delete a pre-existing folder, or frames explicitly kept by the user.
    if (!a.keepFrames) await rm(framesDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  }
}

main().catch(e => { console.error(`\nError: ${e.message}`); process.exitCode = 1; });
