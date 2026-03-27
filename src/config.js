require('dotenv').config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

module.exports = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    // Auth redirect for web login
    loginRedirectUri: `${BASE_URL}/auth/google/callback`,
    // Calendar OAuth redirect (same server)
    calendarRedirectUri: `${BASE_URL}/auth/calendar/callback`,
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  session: {
    secret: process.env.SESSION_SECRET || 'umfufu-' + require('crypto').randomBytes(16).toString('hex'),
  },
  users: {
    // Only these emails can access Umfufu
    allowedEmails: (process.env.ALLOWED_EMAILS || process.env.USER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean),
  },
  delta: {
    username: process.env.DELTA_USERNAME,
    password: process.env.DELTA_PASSWORD,
  },
  marriott: {
    username: process.env.MARRIOTT_USERNAME,
    password: process.env.MARRIOTT_PASSWORD,
  },
  baseUrl: BASE_URL,
};
