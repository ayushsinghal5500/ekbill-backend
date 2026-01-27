import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
// Priority: config.env → .env.local → .env → Vercel env vars
const configEnvPath = path.resolve(__dirname, '../config.env');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(configEnvPath)) {
  dotenv.config({ path: configEnvPath });
  console.log('📄 Loaded config.env');
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('📄 Loaded .env');
} else {
  // Vercel: Uses process.env directly
  dotenv.config();
  console.log('🚀 Using Vercel environment variables');
}

// Validate database configuration
if (!process.env.PGUSER || !process.env.PGHOST || !process.env.PGDATABASE) {
  console.error('❌ Database configuration missing in config.env');
  console.error('Required: PGUSER, PGHOST, PGDATABASE');
  process.exit(1);
}

// Create a PostgreSQL pool with SSL support for Render
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD || '',
  port: process.env.PGPORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL');
    console.log(`📊 Database: ${process.env.PGDATABASE}@${process.env.PGHOST}`);
    client.release();
  })
  .catch((err) => {
    console.error('❌ PostgreSQL connection error:', err.message);
    process.exit(1);
  });

export default pool;