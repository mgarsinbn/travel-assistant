const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const http = require('http');
const config = require('../config');

const TOKEN_DIR = path.join(__dirname, '../../tokens');

function getTokenPath(email) {
  const safe = email.replace(/[^a-z0-9]/gi, '_');
  return path.join(TOKEN_DIR, `${safe}.json`);
}

function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

async function getAuthenticatedClient(email) {
  const tokenPath = getTokenPath(email);
  const oauth2Client = createOAuth2Client();

  if (fs.existsSync(tokenPath)) {
    const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    oauth2Client.setCredentials(tokens);

    // Refresh if expired
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      fs.writeFileSync(tokenPath, JSON.stringify(credentials, null, 2));
      oauth2Client.setCredentials(credentials);
    }

    return oauth2Client;
  }

  return null; // Not authenticated yet
}

async function authorizeUser(email) {
  const oauth2Client = createOAuth2Client();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: config.google.scopes,
    login_hint: email,
    prompt: 'consent',
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (req.url.startsWith('/oauth/callback')) {
        const url = new URL(req.url, 'http://localhost:3333');
        const code = url.searchParams.get('code');

        try {
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          if (!fs.existsSync(TOKEN_DIR)) {
            fs.mkdirSync(TOKEN_DIR, { recursive: true });
          }
          fs.writeFileSync(getTokenPath(email), JSON.stringify(tokens, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Umfufu has your calendar access now! You can close this tab.</h1>');
          server.close();
          resolve(oauth2Client);
        } catch (err) {
          res.writeHead(500);
          res.end('Auth failed');
          server.close();
          reject(err);
        }
      }
    });

    server.listen(3333, () => {
      console.log(`\nOpen this URL to authorize ${email}:\n${authUrl}\n`);
    });
  });
}

async function listEvents(email, timeMin, timeMax) {
  const auth = await getAuthenticatedClient(email);
  if (!auth) throw new Error(`${email} not authenticated. Run authorize first.`);

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
  if (!auth) throw new Error(`${email} not authenticated. Run authorize first.`);

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
  // Check all users' calendars for a given date
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

  // Build busy intervals
  const busy = allEvents
    .filter(e => e.start?.dateTime && e.end?.dateTime)
    .map(e => ({
      start: new Date(e.start.dateTime).getTime(),
      end: new Date(e.end.dateTime).getTime(),
    }))
    .sort((a, b) => a.start - b.start);

  // Find free slots between 9am-6pm
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

module.exports = { authorizeUser, listEvents, createEvent, findFreeSlots, getAuthenticatedClient };
