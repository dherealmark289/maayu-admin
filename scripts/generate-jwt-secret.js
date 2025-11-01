/**
 * Script to generate a secure JWT secret key
 * Run with: node scripts/generate-jwt-secret.js
 */

const crypto = require('crypto');

// Generate a 32-byte random string and encode it in base64
const jwtSecret = crypto.randomBytes(32).toString('base64');

console.log('\n=== JWT Secret Key ===');
console.log(jwtSecret);
console.log('\nCopy this value to your .env.local file as JWT_SECRET\n');


