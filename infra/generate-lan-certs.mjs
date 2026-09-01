/**
 * Genera certificado TLS autofirmado para LAN (API HTTPS entre hosts).
 *
 * Uso:
 * node infra/generate-lan-certs.mjs
 * node infra/generate-lan-certs.mjs 192.168.1.66
 *
 * Luego en backend/.env:
 * TLS_CERT=D:/pulsanet/infra/certs/lan-cert.pem
 * TLS_KEY=D:/pulsanet/infra/certs/lan-key.pem
 * CORS_ORIGINS=...,https://192.168.1.66:5173
 *
 * Clientes deben confiar el cert (o aceptar excepción) en navegador/móvil.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'certs');
const days = 825;
const extraHosts = process.argv.slice(2).filter(Boolean);

fs.mkdirSync(outDir, { recursive: true });

const altNames = ['localhost', '127.0.0.1', '::1', ...extraHosts];

async function viaSelfsigned() {
 const require = createRequire(import.meta.url);
 let selfsigned;
 try {
 selfsigned = require('selfsigned');
 } catch {
 try {
 selfsigned = require(path.join(__dirname, '../backend/node_modules/selfsigned'));
 } catch {
 return false;
 }
 }

 const attrs = [{ name: 'commonName', value: extraHosts[0] || 'tacticalptx-lan' }];
 const pems = await selfsigned.generate(attrs, {
 days,
 keySize: 2048,
 algorithm: 'sha256',
 extensions: [
 { name: 'basicConstraints', cA: false },
 {
 name: 'keyUsage',
 digitalSignature: true,
 keyEncipherment: true,
 },
 {
 name: 'extKeyUsage',
 serverAuth: true,
 },
 {
 name: 'subjectAltName',
 altNames: altNames.map((h) =>
 /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')
 ? { type: 7, ip: h === '::1' ? '127.0.0.1' : h }
 : { type: 2, value: h }
 ),
 },
 ],
 });

 const cert = pems.cert || pems.certificate;
 const key = pems.private || pems.privateKey || pems.key;
 if (!cert || !key) {
 console.error('selfsigned: respuesta inesperada', Object.keys(pems));
 return false;
 }
 fs.writeFileSync(path.join(outDir, 'lan-cert.pem'), cert);
 fs.writeFileSync(path.join(outDir, 'lan-key.pem'), key);
 return true;
}

function viaPowershell() {
 const dnsList = altNames.map((h) => `"${h}"`).join(',');
 const certPath = path.join(outDir, 'lan-cert.pem').replace(/\\/g, '/');
 const keyPath = path.join(outDir, 'lan-key.pem').replace(/\\/g, '/');
 const pfxPath = path.join(outDir, 'lan.pfx').replace(/\\/g, '/');

 const ps = `
$ErrorActionPreference = 'Stop'
$dns = @(${dnsList})
$cert = New-SelfSignedCertificate -DnsName $dns -CertStoreLocation 'Cert:\\CurrentUser\\My' -NotAfter (Get-Date).AddDays(${days}) -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -FriendlyName 'TacticalPtx-LAN'
$pwd = ConvertTo-SecureString -String 'tacticalptx-temp' -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath '${pfxPath}' -Password $pwd | Out-Null
# Export public cert as Base64 PEM
$b64 = [Convert]::ToBase64String($cert.RawData)
$pem = "-----BEGIN CERTIFICATE-----\`n"
for ($i=0; $i -lt $b64.Length; $i+=64) { $pem += $b64.Substring($i, [Math]::Min(64, $b64.Length-$i)) + "\`n" }
$pem += "-----END CERTIFICATE-----\`n"
Set-Content -Path '${certPath}' -Value $pem -Encoding ascii
# Private key: use certutil / openssl if available — write PFX note
Write-Output "PFX=${pfxPath}"
Write-Output "CERT=${certPath}"
Remove-Item -Path "Cert:\\CurrentUser\\My\\$($cert.Thumbprint)" -ErrorAction SilentlyContinue
`;
 try {
 execSync(`powershell -NoProfile -Command ${JSON.stringify(ps)}`, {
 stdio: 'inherit',
 windowsHide: true,
 });
 // Without openssl we cannot easily extract private key from PFX in pure PS.
 // Leave PFX for ops; prefer selfsigned npm.
 return fs.existsSync(path.join(outDir, 'lan-cert.pem'));
 } catch {
 return false;
 }
}

const ok = (await viaSelfsigned()) || viaPowershell();
if (!ok) {
 console.error('No se pudo generar el certificado.');
 console.error('Instala dependencia: cd backend && npm install selfsigned --save-dev');
 console.error('Luego: node infra/generate-lan-certs.mjs [IP-LAN]');
 process.exit(1);
}

const certFile = path.join(outDir, 'lan-cert.pem');
const keyFile = path.join(outDir, 'lan-key.pem');
if (!fs.existsSync(keyFile)) {
 console.warn('Solo se generó el .pem público / PFX. Instala selfsigned para key PEM:');
 console.warn(' cd backend && npm i -D selfsigned && node ../infra/generate-lan-certs.mjs');
 process.exit(2);
}

console.log('OK certificados LAN:');
console.log(' ', certFile);
console.log(' ', keyFile);
console.log('Hosts:', altNames.join(', '));
console.log('\nEn backend/.env:');
console.log(`TLS_CERT=${certFile}`);
console.log(`TLS_KEY=${keyFile}`);
