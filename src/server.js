const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const config = require('./config');
const { SYSTEM_PROMPT } = require('./umfufu');
const tools = require('./tools/definitions');
const { handleToolCall } = require('./tools/handler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// In-memory conversation sessions (keyed by session ID)
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [] });
  }
  return sessions.get(sessionId);
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const session = getSession(sessionId);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Umfufu is ALIVE and UNHINGED', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Umfufu is live on port ${PORT}`);
  console.log(`  http://localhost:${PORT}\n`);
});
