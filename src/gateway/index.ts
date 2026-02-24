#!/usr/bin/env tsx
import { startGateway } from './gateway.js';

async function run(): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('Error: TELEGRAM_BOT_TOKEN environment variable is required.');
    console.error('Get a token from @BotFather on Telegram and set it in your .env file.');
    process.exit(1);
  }

  console.log('Starting Alchemist Telegram gateway...');
  const server = await startGateway();
  console.log('Alchemist Telegram gateway running. Press Ctrl+C to stop.');

  const shutdown = async () => {
    console.log('\nShutting down...');
    await server.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void run();
