const crypto = require('crypto');
const { google } = require('googleapis');
const config = require('./config');
const calendar = require('./services/calendar');

// In-memory session store (token -> { email, name, picture, expiresAt })
const activeSessions = new Map();

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const COOKIE_NAME = 'umfufu_session';

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.loginRedirectUri
  );
}

function getLoginUrl() {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid', 'email', 'profile',
      ...config.google.scopes, // calendar scopes
    ],
    prompt: 'consent', // force consent to get refresh token
  });
}

async function handleCallback(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user info
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  const email = data.email.toLowerCase();

  // Check allowlist
  if (config.users.allowedEmails.length > 0 && !config.users.allowedEmails.includes(email)) {
    return { allowed: false, email };
  }

  // Store calendar tokens so Umfufu can access their calendar
  calendar.saveTokens(email, tokens);
  console.log(`Calendar tokens saved for ${email}`);

  // Create session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  activeSessions.set(sessionToken, {
    email,
    name: data.name,
    picture: data.picture,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  });

  return { allowed: true, sessionToken, email, name: data.name, picture: data.picture };
}

function validateSession(token) {
  if (!token) return null;

  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  return session;
}

function destroySession(token) {
  activeSessions.delete(token);
}

// Express middleware: require auth on all routes except /auth/* and /api/health
function requireAuth(req, res, next) {
  // Allow auth routes and health check through
  if (req.path.startsWith('/auth/') || req.path === '/api/health') {
    return next();
  }

  // Allow the login page through
  if (req.path === '/login') {
    return next();
  }

  const token = parseCookie(req.headers.cookie, COOKIE_NAME);
  const session = validateSession(token);

  if (!session) {
    // API calls get 401, page requests get redirected to login
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Not authenticated. Please log in.' });
    }
    return res.redirect('/login');
  }

  // Attach user to request
  req.user = session;
  next();
}

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(';').find(c => c.trim().startsWith(`${name}=`));
  return match ? match.trim().split('=')[1] : null;
}

function setSessionCookie(res, token) {
  const maxAge = SESSION_DURATION_MS / 1000;
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}; Secure`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

module.exports = {
  getLoginUrl,
  handleCallback,
  validateSession,
  destroySession,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  COOKIE_NAME,
  parseCookie,
};
