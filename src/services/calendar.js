const { google } = require('googleapis');
const config = require('../config');

// In-memory token store (email -> tokens)
// In production, you'd want to persist these to a database or S3
const tokenStore = new Map();

function createOAuth2Client(redirectUri) {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    redirectUri || `${config.baseUrl}/auth/calendar/callback`
  );
}

function getAuthUrl(email) {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: config.google.scopes,
    login_hint: email,
    prompt: 'consent',
    state: email, // pass email through state param
  });
}

async function handleAuthCallback(code) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function saveTokens(email, tokens) {
  tokenStore.set(email.toLowerCase(), tokens);
}

function getTokens(email) {
  return tokenStore.get(email.toLowerCase());
}

async function getAuthenticatedClient(email) {
  const tokens = getTokens(email);
  if (!tokens) return null;

  const client = createOAuth2Client();
  client.setCredentials(tokens);

  // Refresh if expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials } = await client.refreshAccessToken();
      saveTokens(email, credentials);
      client.setCredentials(credentials);
    } catch (err) {
      // Token refresh failed — user needs to re-auth
      tokenStore.delete(email.toLowerCase());
      return null;
    }
  }

  return client;
}

function isAuthorized(email) {
  return tokenStore.has(email.toLowerCase());
}

async function listEvents(email, timeMin, timeMax) {
  const auth = await getAuthenticatedClient(email);
  if (!auth) throw new Error(`Calendar not connected for ${email}. Please authorize first by clicking the link Umfufu provides.`);

  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return res.data.items || [];
}

async function createEvent(email, { summary, description, startTime, endTime, attendees }) {
  const auth = await getAuthenticatedClient(email);
  if (!auth) throw new Error(`Calendar not connected for ${email}. Please authorize first.`);

  const calendar = google.calendar({ version: 'v3', auth });
  const event = {
    summary,
    description,
    start: { dateTime: startTime, timeZone: 'America/New_York' },
    end: { dateTime: endTime, timeZone: 'America/New_York' },
    attendees: (attendees || []).map(e => ({ email: e })),
    conferenceData: {
      createRequest: { requestId: `umfufu-${Date.now()}` },
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: 1,
    sendUpdates: 'all',
  });

  return res.data;
}

async function findFreeSlots(emails, date, durationMinutes = 30) {
  const allEvents = [];
  for (const email of emails) {
    try {
      const dayStart = new Date(date);
      dayStart.setHours(9, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(18, 0, 0, 0);
      const events = await listEvents(email, dayStart.toISOString(), dayEnd.toISOString());
      allEvents.push(...events);
    } catch (err) {
      // Skip unauthenticated users
    }
  }

  const busy = allEvents
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({
      start: new Date(e.start.dateTime).getTime(),
      end: new Date(e.end.dateTime).getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  const dayStart = new Date(date);
  dayStart.setHours(9, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(18, 0, 0, 0);
  const durationMs = durationMinutes * 60 * 1000;

  const freeSlots = [];
  let cursor = dayStart.getTime();

  for (const block of busy) {
    if (block.start - cursor >= durationMs) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(block.start).toISOString(),
      });
    }
    cursor = Math.max(cursor, block.end);
  }

  if (dayEnd.getTime() - cursor >= durationMs) {
    freeSlots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(dayEnd.getTime()).toISOString(),
    });
  }

  return freeSlots;
}

module.exports = {
  getAuthUrl,
  handleAuthCallback,
  saveTokens,
  isAuthorized,
  getAuthenticatedClient,
  listEvents,
  createEvent,
  findFreeSlots,
};
