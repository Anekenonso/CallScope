// docs/qa/test-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const tmpDir = path.join(os.tmpdir(), 'chrome_qa_' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Spawning Chrome with profile:', tmpDir);
const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9222',
  '--remote-allow-origins=*',
  `--user-data-dir=${tmpDir}`,
  '--disable-gpu',
  '--no-first-run',
  'about:blank'
], { stdio: 'pipe' });

proc.stderr.on('data', (d) => console.log('stderr:', d.toString()));
proc.stdout.on('data', (d) => console.log('stdout:', d.toString()));

async function check() {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      const data = await res.json();
      console.log('SUCCESS! CDP version:', data);
      proc.kill();
      return;
    } catch (e) {
      // wait
    }
  }
  console.log('Failed to connect to CDP');
  proc.kill();
}

check().catch(console.error);

