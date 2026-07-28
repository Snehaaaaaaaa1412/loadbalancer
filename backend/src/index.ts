import express from 'express';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';

const app = express();

app.use(cors({
  origin: config.corsOrigin,
}));
app.use(express.json());

// Load Balancer routes gateway routing
import loadBalancerRoutes from './routes/loadBalancerRoutes';
import { errorHandler } from './middlewares/errorHandler';

app.use('/api/loadbalancer', loadBalancerRoutes);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Centralized error handler catches all uncaught exceptions
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`Load Balancer Gateway running on port ${config.port} in ${config.nodeEnv} mode`);
  
  // Lazy initialize Redis infrastructure out-of-band to prevent boot blocking
  import('./controlplane/RedisClient')
    .then(async ({ RedisClient }) => {
      const redis = RedisClient.getInstance();
      if (redis.isRedisEnabled()) {
        const { ConfigSubscriber } = await import('./controlplane/ConfigSubscriber');
        const subscriber = new ConfigSubscriber();

        const { service } = await import('./routes/loadBalancerRoutes');
        
        // Wire up the dynamic config update handler
        subscriber.on('clusterUpdated', async (payload: { clusterName: string; version: number }) => {
          await service.handleConfigUpdate(payload.clusterName, payload.version);
        });

        await subscriber.subscribe();
        
        // Retain subscriber instance on global context for lifecycle shutdown cleanups
        (global as any).subscriber = subscriber;
      }
    })
    .catch((err: any) => {
      logger.error(`Failed to initialize Redis Control Plane client: ${err.message}`);
    });
});

// Graceful shutdown handling for containerized/cloud environments (draining connections)
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // 1. Stop accepting new connections first
  server.close(async () => {
    logger.info('HTTP server closed. Connections drained. Cleaning up dependencies...');
    
    // Unsubscribe subscriber to clear any pending Redis sockets cleanly
    if ((global as any).subscriber) {
      try {
        await (global as any).subscriber.unsubscribe();
      } catch (err: any) {
        logger.error(`Error during subscriber unsubscribe: ${err.message}`);
      }
    }

    // 2. Shut down Redis connection pool after requests have drained
    try {
      const { RedisClient } = await import('./controlplane/RedisClient');
      await RedisClient.getInstance().shutdown();
    } catch (err: any) {
      logger.error(`Error during Redis control plane shutdown: ${err.message}`);
    }

    logger.info('Graceful shutdown complete. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after 10s watchdog timeout if connections are hanging
  setTimeout(() => {
    logger.error('Graceful shutdown watchdog timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
