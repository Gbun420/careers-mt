const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load local env files for build-time config (optional but helpful for local dev)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Read Firebase config from environment (support legacy name too)
const firebaseConfigStr =
  process.env.NEXT_PUBLIC_FIREBASE_CONFIG ||
  process.env.FIREBASE_CLIENT_CONFIG ||
  process.env.FIREBASE_CONFIG ||
  '{}';

let firebaseConfig = {};
try {
  firebaseConfig = JSON.parse(firebaseConfigStr);
} catch (e) {
  console.warn('⚠️  Warning: NEXT_PUBLIC_FIREBASE_CONFIG is not valid JSON. Using empty config.');
}

// Generate the config JS content
const configContent = `// Auto-generated during build
window.firebaseConfig = ${JSON.stringify(firebaseConfig, null, 2)};
`;

const configPath = path.join(__dirname, '../public/firebase-config.js');
try {
  fs.writeFileSync(configPath, configContent);
  console.log('✅ Created public/firebase-config.js');
} catch (err) {
  console.error(`❌ Error writing config: ${err.message}`);
  process.exit(1);
}
