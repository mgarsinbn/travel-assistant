require('dotenv').config();

module.exports = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-6',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: 'http://localhost:3333/oauth/callback',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  },
  users: {
    emails: (process.env.USER_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean),
  },
  delta: {
    username: process.env.DELTA_USERNAME,
    password: process.env.DELTA_PASSWORD,
  },
  marriott: {
    username: process.env.MARRIOTT_USERNAME,
    password: process.env.MARRIOTT_PASSWORD,
  },
};
