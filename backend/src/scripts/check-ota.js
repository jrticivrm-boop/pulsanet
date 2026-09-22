import fs from 'fs';
import 'dotenv/config';

const secret = process.env.APP_UPDATE_SECRET;
if (!secret) {
  console.error('Sin APP_UPDATE_SECRET en .env');
  process.exit(1);
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function domainFromEnv() {
  const d = (process.env.PUBLIC_DOMAIN || '').trim().replace(/^https?:\/\//i, '');
  return d || 'pulsanet.duckdns.org';
}

async function probe(label, url) {
  const r = await fetch(url, {
    headers: { 'X-App-Update-Key': secret, Accept: 'application/json' },
  });
  const j = await r.json().catch(() => ({}));
  const summary = {
    label,
    status: r.status,
    ok: j.ok,
    configured: j.configured,
    versionCode: j.versionCode,
    versionName: j.versionName,
    force: j.force,
    hasApkUrl: Boolean(j.apkUrl),
    shaPrefix: String(j.sha256 || '').slice(0, 16),
    error: j.error,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (r.status !== 200 || !j.ok || !j.configured || !j.apkUrl) {
    throw new Error(`OTA unhealthy: ${label}`);
  }
  // HEAD descarga
  const head = await fetch(j.apkUrl, { method: 'HEAD' });
  if (head.status !== 200) {
    throw new Error(`APK HEAD ${head.status} (${label})`);
  }
  return j;
}

const host = domainFromEnv();
const urls = [
  ['local', 'https://127.0.0.1:4000/api/app/android'],
  ['public', `https://${host}/api/app/android`],
];

let failed = false;
for (const [label, url] of urls) {
  try {
    await probe(label, url);
  } catch (e) {
    console.error(String(e.message || e));
    failed = true;
  }
}

const manPath = new URL('../../app-updates/android.json', import.meta.url);
const raw = fs.readFileSync(manPath, 'utf8').replace(/^\uFEFF/, '');
const man = JSON.parse(raw);
console.log(
  JSON.stringify(
    {
      manifestFile: man.versionName + '+' + man.versionCode,
      bom: raw.charCodeAt(0) === 0xfeff,
    },
    null,
    2
  )
);

process.exit(failed ? 1 : 0);
