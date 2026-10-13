const fs = require('fs');
const path = require('path');

const { execFileSync } = require('child_process');

const b64 = (process.env.SINOP_KEYSTORE_BASE64 || '').replace(/\s+/g, '');
const pass = (process.env.SINOP_KEYSTORE_PASSWORD || '').trim();

if (!b64 || !pass) {
  console.log('::error title=Signing key missing::Add the SINOP_KEYSTORE_BASE64 and SINOP_KEYSTORE_PASSWORD secrets in Settings > Secrets and variables > Actions, then re-run this build.');
  process.exit(1);
}

const appDir = path.join(__dirname, '..', 'android', 'app');
const keystorePath = path.join(appDir, 'sinop-upload.keystore');
const bytes = Buffer.from(b64, 'base64');
fs.writeFileSync(keystorePath, bytes);
console.log(`Keystore secret: ${b64.length} base64 chars, ${bytes.length} bytes. Password: ${pass.length} chars.`);

let listing = '';
try {
  listing = execFileSync('keytool', ['-list', '-v', '-keystore', keystorePath, '-storepass', pass, '-alias', 'sinop'], { encoding: 'utf8' });
} catch (e) {
  const out = `${e.stdout || ''}${e.stderr || ''}`.split('\n').filter((l) => /error|exception|password|tampered|alias/i.test(l)).slice(0, 5).join(' | ');
  console.log(`::error title=Signing key check failed::The keystore or password secret is wrong (${bytes.length} bytes, password ${pass.length} chars). keytool says: ${out}`);
  process.exit(1);
}
const sha1 = (listing.match(/SHA1:\s*([0-9A-F:]+)/) || [])[1] || 'unknown';
console.log(`Signing key OK. SHA-1 ${sha1}`);
if (process.env.SINOP_SIGNING_SHA1 && sha1 !== process.env.SINOP_SIGNING_SHA1) {
  console.log(`::warning title=Different signing key::Expected ${process.env.SINOP_SIGNING_SHA1}, got ${sha1}`);
}

const gradlePath = path.join(appDir, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle.replace(
  /signingConfigs\s*\{/,
  `signingConfigs {
        release {
            storeFile file('sinop-upload.keystore')
            storePassword '${pass}'
            keyAlias 'sinop'
            keyPassword '${pass}'
        }`
);

const releaseStart = gradle.indexOf('release {', gradle.indexOf('buildTypes'));
if (releaseStart === -1) throw new Error('Could not find buildTypes.release in build.gradle');
const before = gradle.slice(0, releaseStart);
const after = gradle.slice(releaseStart).replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
fs.writeFileSync(gradlePath, before + after);
console.log('Release builds will be signed with the Sinop upload key.');
