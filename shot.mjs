// Take Emberkeep's four screenshots: real renders of the game's own
// code at 1280x720, one per ?shot= setup in shots.json. Serves game/ on
// localhost, waits for window.__shotReady, and reports console errors
// and any request that is not to localhost (the game must load nothing
// over the network). Dev tool only; main.ts never ships it.
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/makefun/tools-playwright/node_modules/playwright-core/package.json');
const { chromium } = require('playwright-core');
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const W = dirname(fileURLToPath(import.meta.url));
const SHOTS = JSON.parse(readFileSync(join(W, 'shots.json'), 'utf8'));
const exe = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';

const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: W, stdio: 'ignore' });
await new Promise((resolve) => setTimeout(resolve, 1500));

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const external = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));
page.on('request', (r) => {
  const url = r.url();
  if (!url.startsWith('http://localhost:8080') && !url.startsWith('http://127.0.0.1:8080')) {
    external.push(url);
  }
});

for (const shot of SHOTS) {
  await page.goto(`http://localhost:8080/${shot.query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 60000 });
  } catch {
    errors.push(`timeout waiting for __shotReady on ${shot.name}`);
  }
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(W, 'screenshots', shot.name), type: 'jpeg', quality: 82 });
  console.log('shot done:', shot.name);
}

await browser.close();
server.kill();
if (errors.length > 0) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exit(1);
}
if (external.length > 0) {
  console.error('EXTERNAL REQUESTS:\n' + external.join('\n'));
  process.exit(1);
}
console.log('screenshots done, no page errors, no external requests');
