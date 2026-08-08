import { createApp } from './app';
import { env } from './config/env';
import { logger } from './logger';
import { prisma } from './lib/prisma';
import { esClient } from './search/esClient';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'api listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.all([prisma.$disconnect(), esClient.close()]);
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
