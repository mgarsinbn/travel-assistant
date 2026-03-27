const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const config = require('./config');
const { SYSTEM_PROMPT } = require('./umfufu');
const tools = require('./tools/definitions');
const { handleToolCall } = require('./tools/handler');
const auth = require('./auth');

const app = express();
app.use(express.json());

// Public assets needed by login page (before auth middleware)
app.get('/eddie.svg', (req, res) => res.sendFile(path.join(__dirname, '../public/eddie.svg')));
app.get('/eddie.jpg', (req, res) => res.sendFile(path.join(__dirname, '../public/eddie.jpg')));

// Auth routes (before requireAuth middleware)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/auth/google', (req, res) => {
  const url = auth.getLoginUrl();
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing auth code');

  try {
    const result = await auth.handleCallback(code);

    if (!result.allowed) {
      return res.status(403).send(`
        <html><body style="background:#0a0a0a;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
          <div>
            <h1 style="color:#ff4444">ACCESS DENIED</h1>
            <p>Sorry, <strong>${result.email}</strong> is not on Umfufu's guest list.</p>
            <p style="color:#888;margin-top:20px">Only authorized users can access this assistant.<br>Contact Mike or Alexis to get added.</p>
            <a href="/login" style="color:#ff4444;margin-top:20px;display:inline-block">Try again</a>
          </div>
        </body></html>
      `);
    }

    auth.setSessionCookie(res, result.sessionToken);
    res.redirect('/');
  } catch (err) {
    console.error('Auth callback error:', err);
    res.status(500).send('Authentication failed');
  }
});

app.get('/auth/logout', (req, res) => {
  const token = auth.parseCookie(req.headers.cookie, auth.COOKIE_NAME);
  if (token) auth.destroySession(token);
  auth.clearSessionCookie(res);
  res.redirect('/login');
});

// Protect everything below this line
app.use(auth.requireAuth);

// Serve static files (only for authenticated users)
app.use(express.static(path.join(__dirname, '../public')));

// Return current user info
app.get('/api/me', (req, res) => {
  res.json({ email: req.user.email, name: req.user.name, picture: req.user.picture });
});

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// In-memory conversation sessions (keyed by user email)
const sessions = new Map();

function getSession(email) {
  if (!sessions.has(email)) {
    sessions.set(email, { messages: [] });
  }
  return sessions.get(email);
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  const session = getSession(req.user.email);

  session.messages.push({ role: 'user', content: message });

  try {
    let response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: session.messages,
    });

    // Tool use loop
    while (response.stop_reason === 'tool_use') {
      session.messages.push({ role: 'assistant', content: response.content });

      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          try {
            const result = await handleToolCall(block.name, block.input);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (err) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: err.message }),
              is_error: true,
            });
          }
        }
      }

      session.messages.push({ role: 'user', content: toolResults });

      response = await client.messages.create({
        model: config.anthropic.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: session.messages,
      });
    }

    const textBlocks = response.content.filter(b => b.type === 'text');
    const reply = textBlocks.map(b => b.text).join('\n');
    session.messages.push({ role: 'assistant', content: response.content });

    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check (unauthenticated)
app.get('/api/health', (req, res) => {
  res.json({ status: 'Umfufu is ALIVE and UNHINGED', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Umfufu is live on port ${PORT}`);
  console.log(`  Allowed users: ${config.users.allowedEmails.join(', ') || '(none configured — set ALLOWED_EMAILS)'}`);
  console.log(`  http://localhost:${PORT}\n`);
});
