import fs from 'fs';
import 'dotenv/config';

const secret = process.env.APP_UPDATE_SECRET;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const r = await fetch('https://127.0.0.1:4000/api/app/android', {
  headers: { 'X-App-Update-Key': secret, Accept: 'application/json' },
});
const j = await r.json();
console.log(
  JSON.stringify(
    {
      status: r.status,
      ok: j.ok,
      configured: j.configured,
      versionCode: j.versionCode,
      versionName: j.versionName,
      force: j.force,
      hasApkUrl: Boolean(j.apkUrl),
      shaPrefix: String(j.sha256 || '').slice(0, 16),
    },
    null,
    2
  )
);
