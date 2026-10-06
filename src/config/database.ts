import mongoose from 'mongoose';
import { env } from './env.js';

export type DbStatus = 'connected' | 'disconnected';

let listenersRegistered = false;

function registerListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('error', (error: Error) => {
    console.error('❌ MongoDB: error de conexión:', error.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB: desconectado');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('🔁 MongoDB: reconectado');
  });
}

/** Conecta a MongoDB. Si falla al arrancar, termina el proceso: sin base la API no sirve. */
export async function connectDB(): Promise<void> {
  registerListeners();
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
    // Solo el nombre de la base: la cadena completa lleva la contraseña.
    console.log(`✅ MongoDB conectado (base: ${mongoose.connection.name})`);
  } catch (error) {
    console.error('❌ No se pudo conectar a MongoDB:', (error as Error).message);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.connection.close();
}

/** Estado de la conexión para /health. Solo readyState 1 cuenta como conectado. */
export function getDbStatus(): DbStatus {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected
    ? 'connected'
    : 'disconnected';
}
