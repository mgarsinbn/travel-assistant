# Umfufu

Your chaotic, unhinged, sweary AI travel & scheduling assistant who takes her administrative duties VERY seriously.

Built for Mike Garsin and Alexis Wiktorski.

## What Umfufu Does

- **Google Calendar** — View events, find mutual free time, create meetings with Google Meet links
- **Delta Flights** — Search flights, get direct booking URLs
- **Marriott Hotels** — Search hotels, get direct booking URLs

## Setup

```bash
npm install
cp .env.example .env
# Fill in your API keys and credentials
```

### Required: Anthropic API Key
Get one at https://console.anthropic.com

### Required: Google Calendar OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project, enable Calendar API
3. Create OAuth 2.0 credentials (Desktop app)
4. Add `http://localhost:3333/oauth/callback` as a redirect URI
5. Put client ID and secret in `.env`

### Optional: Delta & Marriott credentials
For automated search (uses Puppeteer browser automation).

## Run

```bash
npm start
```

Umfufu will greet you and you can start chatting. First time, you'll need to authorize calendar access:

> "Hey Umfufu, authorize my calendar — mike@example.com"

Then go wild:

> "Book a meeting with Alexis next Tuesday at 2pm"
> "Find me a Delta flight from JFK to LAX on April 15"
> "I need a Marriott in Chicago for April 15-17"
