import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Singleton Redis connection infrastructure provider.
 * Manages separate command/publishing and subscription clients,
 * ensuring clean separation as required by Redis Pub/Sub specifications.
 */
export class RedisClient {
  private static instance: RedisClient | null = null;
  private commandClient: Redis | null = null;
  private subscriptionClient: Redis | null = null;
  private readonly isEnabled: boolean;

  private constructor() {
    this.isEnabled = config.useRedis;
    if (this.isEnabled) {
      logger.info('Control Plane Redis infrastructure is enabled. Initializing clients...');
      this.initClients();
    } else {
      logger.info('Control Plane Redis infrastructure is disabled. Running in standalone local memory mode.');
    }
  }

  /**
   * Retrieves the singleton RedisClient instance.
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Initializes command and subscription Redis clients.
   */
  private initClients(): void {
    const redisOptions = {
      maxRetriesPerRequest: null, // Essential for ioredis pub/sub stability
      reconnectOnError: (err: Error) => {
        logger.error(`Redis client reconnection error triggered: ${err.message}`);
        return true; // Reconnect automatically
      },
    };

    this.commandClient = new Redis(config.redisUrl, redisOptions);
    this.subscriptionClient = new Redis(config.redisUrl, redisOptions);

    this.setupConnectionEvents(this.commandClient, 'CommandClient');
    this.setupConnectionEvents(this.subscriptionClient, 'SubscriptionClient');
  }

  /**
   * Configures Winston log routing on connection states.
   */
  private setupConnectionEvents(client: Redis, label: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${label} successfully connected to ${config.redisUrl}`);
    });

    client.on('error', (err: any) => {
      logger.error(`Redis ${label} connection error: ${err.message}`);
    });

    client.on('close', () => {
      logger.warn(`Redis ${label} connection closed.`);
    });

    client.on('reconnecting', (delay: number) => {
      logger.info(`Redis ${label} reconnecting in ${delay}ms...`);
    });
  }

  /**
   * Returns the command client instance. Returns null if Redis is disabled.
   */
  public getCommandClient(): Redis | null {
    return this.commandClient;
  }

  /**
   * Returns the subscription client instance. Returns null if Redis is disabled.
   */
  public getSubscriptionClient(): Redis | null {
    return this.subscriptionClient;
  }

  /**
   * Closes connections gracefully during application shutdown.
   */
  public async shutdown(): Promise<void> {
    if (!this.isEnabled) return;

    logger.info('Shutting down Control Plane Redis connections gracefully...');
    const promises: Promise<string>[] = [];

    if (this.commandClient) {
      promises.push(this.commandClient.quit());
    }
    if (this.subscriptionClient) {
      promises.push(this.subscriptionClient.quit());
    }

    try {
      await Promise.all(promises);
      logger.info('Redis connections closed successfully.');
    } catch (err: any) {
      logger.error(`Error closing Redis connections during shutdown: ${err.message}`);
    }
  }

  /**
   * Check if Redis integration is enabled.
   */
  public isRedisEnabled(): boolean {
    return this.isEnabled;
  }
}
