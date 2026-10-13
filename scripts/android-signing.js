const fs = require('fs');
const path = require('path');

const b64 = process.env.SINOP_KEYSTORE_BASE64;
const pass = process.env.SINOP_KEYSTORE_PASSWORD;

if (!b64 || !pass) {
  console.log('::error title=Signing key missing::Add the SINOP_KEYSTORE_BASE64 and SINOP_KEYSTORE_PASSWORD secrets in Settings > Secrets and variables > Actions, then re-run this build.');
  process.exit(1);
}

const appDir = path.join(__dirname, '..', 'android', 'app');
fs.writeFileSync(path.join(appDir, 'sinop-upload.keystore'), Buffer.from(b64.trim(), 'base64'));

const gradlePath = path.join(appDir, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');

gradle = gradle.replace(
  /signingConfigs\s*\{/,
  `signingConfigs {
        release {
            storeFile file('sinop-upload.keystore')
            storePassword System.getenv('SINOP_KEYSTORE_PASSWORD')
            keyAlias 'sinop'
            keyPassword System.getenv('SINOP_KEYSTORE_PASSWORD')
        }`
);

const releaseStart = gradle.indexOf('release {', gradle.indexOf('buildTypes'));
if (releaseStart === -1) throw new Error('Could not find buildTypes.release in build.gradle');
const before = gradle.slice(0, releaseStart);
const after = gradle.slice(releaseStart).replace('signingConfig signingConfigs.debug', 'signingConfig signingConfigs.release');
fs.writeFileSync(gradlePath, before + after);
console.log('Release builds will be signed with the Sinop upload key.');
