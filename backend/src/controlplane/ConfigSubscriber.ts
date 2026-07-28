import { EventEmitter } from 'events';
import { RedisClient } from './RedisClient';
import { logger } from '../utils/logger';

/**
 * Event payload structure for cluster configurations updates.
 */
export interface ClusterUpdatePayload {
  clusterName: string;
  version: number;
  timestamp: string;
}

/**
 * Control Plane Redis subscription listener.
 * Connects to Redis Pub/Sub channels, validates incoming event payloads,
 * and emits local events. Contains zero routing or mapping business logic.
 */
export class ConfigSubscriber extends EventEmitter {
  private readonly redisClient: RedisClient;
  private readonly channel = 'lb:config-updates';
  private isSubscribed = false;

  constructor() {
    super();
    this.redisClient = RedisClient.getInstance();
  }

  /**
   * Bound message event listener property. Ensures correct context and a static reference
   * suitable for registration and subsequent removal.
   */
  private readonly onMessage = (channel: string, message: string): void => {
    if (channel === this.channel) {
      this.handleIncomingMessage(message);
    }
  };

  /**
   * Begins listening to the configurations update channel.
   */
  public async subscribe(): Promise<void> {
    if (!this.redisClient.isRedisEnabled()) {
      logger.debug('Redis is disabled; ConfigSubscriber subscription skipped.');
      return;
    }

    if (this.isSubscribed) return;

    const sub = this.redisClient.getSubscriptionClient();
    if (!sub) {
      logger.error('Subscription Redis client is unavailable.');
      return;
    }

    try {
      await sub.subscribe(this.channel);
      this.isSubscribed = true;
      logger.info(`ConfigSubscriber successfully subscribed to Redis channel: ${this.channel}`);

      // Register the bound message handler
      sub.on('message', this.onMessage);
    } catch (err: any) {
      logger.error(`Failed to subscribe to Redis channel ${this.channel}: ${err.message}`);
    }
  }

  /**
   * Validates and parses the message payload before emitting.
   */
  private handleIncomingMessage(message: string): void {
    try {
      logger.debug(`ConfigSubscriber received message payload: ${message}`);
      const payload: ClusterUpdatePayload = JSON.parse(message);

      if (!payload.clusterName || typeof payload.version !== 'number' || !payload.timestamp) {
        logger.warn('Received invalid payload shape. Discarding message.');
        return;
      }

      // Emit to local listeners (e.g. Services, Managers)
      this.emit('clusterUpdated', payload);
    } catch (err: any) {
      logger.error(`Error parsing Pub/Sub message: ${err.message}. Message: ${message}`);
    }
  }

  /**
   * Gracefully unsubscribes from Redis channels.
   */
  public async unsubscribe(): Promise<void> {
    if (!this.isSubscribed) return;

    const sub = this.redisClient.getSubscriptionClient();
    if (sub) {
      // Safely detach listener and reset flag first to guarantee local cleanup even if network call throws
      sub.off('message', this.onMessage);
      this.isSubscribed = false;
      
      try {
        await sub.unsubscribe(this.channel);
        logger.info(`Unsubscribed from Redis channel: ${this.channel}`);
      } catch (err: any) {
        logger.error(`Error during Redis network unsubscription: ${err.message}`);
      }
    }
  }
}
