import { BaseStrategy } from './BaseStrategy';
import { Server } from '../models/Server';
import { ServerCluster } from '../models/ServerCluster';
import { StrategyInitializationConfig } from '../types';
import { logger } from '../utils/logger';

/**
 * Standard Round Robin load balancing strategy.
 * Synchronously distributes traffic sequentially across all available servers in the cluster.
 */
export class RoundRobin extends BaseStrategy {
  public initializeCluster(cluster: ServerCluster, config: StrategyInitializationConfig): void {
    const { noOfServers } = config;
    if (noOfServers <= 0) {
      throw new Error('Number of servers must be greater than zero.');
    }

    const serversList: Server[] = [];
    for (let i = 0; i < noOfServers; i++) {
      serversList.push(new Server(i + 1));
    }
    cluster.setServers(serversList);
    logger.info(`Round Robin strategy initialized with ${noOfServers} servers.`);
  }

  public route(cluster: ServerCluster): number {
    const { servers, roundRobinIndex } = cluster;
    if (servers.length === 0) {
      logger.warn('Round Robin strategy not initialized or server list empty.');
      return -1;
    }

    const server = servers[roundRobinIndex];
    
    // Increment index synchronously (atomic in Node's single-threaded event loop)
    cluster.roundRobinIndex = (roundRobinIndex + 1) % servers.length;

    return server.assignRequest();
  }
}
