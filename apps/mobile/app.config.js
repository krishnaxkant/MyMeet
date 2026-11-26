const path = require('node:path');
const dotenv = require('dotenv');
const appJson = require('./app.json');

// Load root .env first, then allow apps/mobile/.env overrides
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

// SECURITY: Only expose public Supabase URL & anon key to mobile client.
// NEVER expose SUPABASE_SERVICE_ROLE_KEY here.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';

module.exports = {
  ...appJson.expo,
  extra: {
    ...(appJson.expo.extra || {}),
    supabaseUrl,
    supabaseAnonKey,
    apiUrl,
  },
};
