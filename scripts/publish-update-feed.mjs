import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const version = process.env.VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) throw new Error('Invalid release version');
const candidate = JSON.parse(readFileSync(`downloads/v${version}/latest.json`, 'utf8'));
if (candidate.version !== version) throw new Error('Manifest version mismatch');
let previous;
try {
  previous = JSON.parse(readFileSync('updates/windows-x64.json', 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
if (previous) {
  if (!/^\d+\.\d+\.\d+$/.test(previous.version)) throw new Error('Invalid existing feed');
  const old = previous.version.split('.').map(Number);
  const next = version.split('.').map(Number);
  const index = next.findIndex((value, i) => value !== old[i]);
  if (index === -1 || next[index] < old[index]) process.exit(0);
}
mkdirSync('updates', { recursive: true });
writeFileSync('updates/windows-x64.json', JSON.stringify(candidate, null, 2) + '\n');
