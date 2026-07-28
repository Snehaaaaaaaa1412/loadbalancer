import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the .env file in the backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  useRedis: process.env.USE_REDIS === 'true',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
export type Config = typeof config;
