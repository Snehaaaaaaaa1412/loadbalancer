import { RedisClient } from './RedisClient';
import { ClusterUpdatePayload } from './ConfigSubscriber';
import { logger } from '../utils/logger';

/**
 * Control Plane Redis configuration event publisher.
 * Enables pushing configuration and health state updates to all active gateway instances.
 */
export class ConfigPublisher {
  private readonly redisClient: RedisClient;
  private readonly channel = 'lb:config-updates';

  constructor() {
    this.redisClient = RedisClient.getInstance();
  }

  /**
   * Publishes a cluster configuration update payload to all gateway instances.
   */
  public async publishUpdate(clusterName: string, version: number): Promise<boolean> {
    if (!this.redisClient.isRedisEnabled()) {
      logger.debug('Redis is disabled; ConfigPublisher publish ignored.');
      return false;
    }

    const pub = this.redisClient.getCommandClient();
    if (!pub) {
      logger.error('Command/Publish Redis client is unavailable.');
      return false;
    }

    const payload: ClusterUpdatePayload = {
      clusterName,
      version,
      timestamp: new Date().toISOString(),
    };

    try {
      const message = JSON.stringify(payload);
      const subscribersCount = await pub.publish(this.channel, message);
      logger.info(`Successfully published config update (Version: ${version}) on channel '${this.channel}' to ${subscribersCount} subscribers.`);
      return true;
    } catch (err: any) {
      logger.error(`Failed to publish configuration update on channel ${this.channel}: ${err.message}`);
      return false;
    }
  }
}
