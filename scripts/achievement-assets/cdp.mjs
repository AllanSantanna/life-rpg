/**
 * Cliente CDP mínimo para o Chromium instalado pelo Playwright. Usado apenas
 * como ferramenta local (codificação WebP pelo Canvas e capturas de revisão);
 * dispensa o pacote `playwright`. Defina `CHROMIUM_EXECUTABLE` se necessário.
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

function findChromium() {
  if (process.env.CHROMIUM_EXECUTABLE) return process.env.CHROMIUM_EXECUTABLE;
  const root = join(homedir(), '.cache', 'ms-playwright');
  const builds = existsSync(root)
    ? readdirSync(root)
        .filter((name) => /^chromium-\d+$/.test(name))
        .sort()
    : [];
  for (const build of builds.reverse()) {
    const candidate = join(root, build, 'chrome-linux64', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Chromium não encontrado; instale-o com Playwright ou defina CHROMIUM_EXECUTABLE.',
  );
}

export async function launchBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'life-rpg-cdp-'));
  const child = spawn(
    findChromium(),
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt += 1) {
    await delay(100);
  }
  if (!existsSync(portFile)) {
    child.kill();
    throw new Error('Chromium não iniciou o DevTools');
  }
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = targets.find((target) => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      );
    }
    return result.result.value;
  };
  const waitFor = (method) =>
    new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method) {
          listeners.delete(listener);
          resolve(message.params);
        }
      };
      listeners.add(listener);
    });
  const close = async () => {
    socket.close();
    child.kill();
    await delay(200);
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, evaluate, waitFor, close };
}

/** Codifica RGBA em WebP pelo Canvas do Chromium; retorna um Buffer. */
export async function encodeWebp(browser, { width, height, data }, quality) {
  const base64 = Buffer.from(
    data.buffer,
    data.byteOffset,
    data.length,
  ).toString('base64');
  const dataUrl = await browser.evaluate(`(() => {
    const bytes = Uint8ClampedArray.from(atob('${base64}'), (c) => c.charCodeAt(0));
    const canvas = document.createElement('canvas');
    canvas.width = ${width};
    canvas.height = ${height};
    const context = canvas.getContext('2d', { colorSpace: 'srgb' });
    context.putImageData(new ImageData(bytes, ${width}, ${height}), 0, 0);
    return canvas.toDataURL('image/webp', ${quality});
  })()`);
  if (!dataUrl.startsWith('data:image/webp;base64,')) {
    throw new Error('o Chromium não codificou WebP');
  }
  return Buffer.from(dataUrl.slice('data:image/webp;base64,'.length), 'base64');
}
