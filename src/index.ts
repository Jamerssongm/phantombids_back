import type { Server } from 'node:http';
import { app } from './app.js';
import { connectDB, disconnectDB } from './config/database.js';
import { env } from './config/env.js';
import { startAuctionScheduler, stopAuctionScheduler } from './services/scheduler.service.js';
import { logger } from './utils/logger.js';

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} recibido: cerrando servidor...`);

  // Si algo se cuelga, no esperar para siempre (Render mata el proceso a los 30 s).
  setTimeout(() => {
    logger.error('Cierre forzado: superado el tiempo de espera');
    process.exit(1);
  }, 10_000).unref();

  try {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
      logger.info('Servidor HTTP cerrado');
    }
    // Antes de cerrar la base: una pasada a medio liquidar no debe perder la conexión.
    await stopAuctionScheduler();
    await disconnectDB();
    logger.info('Conexión a MongoDB cerrada');
  } catch (error) {
    logger.error('Error durante el cierre:', error);
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection:', reason);
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.error('uncaughtException:', error);
  void shutdown('uncaughtException', 1);
});

async function main(): Promise<void> {
  await connectDB();
  if (env.AUTO_CLOSE_ENABLED) startAuctionScheduler();
  else logger.info('Scheduler de subastas desactivado (AUTO_CLOSE_ENABLED=false)');
  server = app.listen(env.PORT, () => {
    logger.info(`PhantomBids API escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    const reason =
      error.code === 'EADDRINUSE' ? `el puerto ${env.PORT} ya está en uso` : error.message;
    logger.error(`No se pudo levantar el servidor: ${reason}`);
    void shutdown('error de arranque', 1);
  });
}

void main();
