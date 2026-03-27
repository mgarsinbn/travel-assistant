const Anthropic = require('@anthropic-ai/sdk');
const readline = require('readline');
const config = require('./config');
const { SYSTEM_PROMPT } = require('./umfufu');
const tools = require('./tools/definitions');
const { handleToolCall } = require('./tools/handler');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const conversationHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function chat(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  let response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages: conversationHistory,
  });

  // Tool use loop — keep going until Umfufu is done calling tools
  while (response.stop_reason === 'tool_use') {
    const assistantContent = response.content;
    conversationHistory.push({ role: 'assistant', content: assistantContent });

    const toolResults = [];
    for (const block of assistantContent) {
      if (block.type === 'tool_use') {
        console.log(`\n  [Umfufu is using: ${block.name}...]`);
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

    conversationHistory.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: conversationHistory,
    });
  }

  // Extract text response
  const textBlocks = response.content.filter(b => b.type === 'text');
  const reply = textBlocks.map(b => b.text).join('\n');

  conversationHistory.push({ role: 'assistant', content: response.content });

  return reply;
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  🌀 UMFUFU IS ONLINE');
  console.log('  Your chaotic travel & scheduling assistant');
  console.log('  Type "quit" to exit');
  console.log('='.repeat(60) + '\n');

  // Greeting
  const greeting = await chat('Hey Umfufu, you there?');
  console.log(`\nUmfufu: ${greeting}\n`);

  while (true) {
    const input = await prompt('You: ');
    if (!input || input.toLowerCase() === 'quit') {
      console.log('\nUmfufu: Later, you beautiful disasters. Don\'t book anything without me!! 💀\n');
      rl.close();
      process.exit(0);
    }

    try {
      const reply = await chat(input);
      console.log(`\nUmfufu: ${reply}\n`);
    } catch (err) {
      console.error(`\n[Error: ${err.message}]\n`);
    }
  }
}

main().catch(console.error);
