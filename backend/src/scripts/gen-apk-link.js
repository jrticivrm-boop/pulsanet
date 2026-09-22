import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
const env = fs.readFileSync(envPath, 'utf8');

function readEnv(key) {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
}

const secret = readEnv('APP_UPDATE_SECRET');
if (!secret) {
  console.error('Sin APP_UPDATE_SECRET');
  process.exit(1);
}

const name = 'TacticalPtx.apk';
const ttlSec = parseInt(process.argv[2] || '86400', 10);
const exp = Math.floor(Date.now() / 1000) + ttlSec;
const sig = crypto.createHmac('sha256', secret).update(`${name}.${exp}`).digest('hex');
const host = process.argv[3] || readEnv('PUBLIC_DOMAIN');
if (!host) {
  console.error('Sin PUBLIC_DOMAIN en .env ni host en argv[3]');
  process.exit(1);
}
const url = `https://${host}/api/app/android/file/${encodeURIComponent(name)}?t=${exp}.${sig}`;
console.log(url);
