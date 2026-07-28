import { ServerCluster } from '../models/ServerCluster';
import { StrategyInitializationConfig } from '../types';

/**
 * Base abstract class for all load balancer strategies.
 * Defines stateless algorithms that operate directly on a given ServerCluster context.
 */
export abstract class BaseStrategy {
  /**
   * Initializes the server instances inside the given cluster config.
   */
  public abstract initializeCluster(
    cluster: ServerCluster,
    config: StrategyInitializationConfig
  ): void;

  /**
   * Routes the request to a chosen server within the cluster and returns its server ID.
   * Returns -1 if no servers are available or all are at capacity.
   */
  public abstract route(cluster: ServerCluster): number;
}
