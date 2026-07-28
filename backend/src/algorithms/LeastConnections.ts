import { BaseStrategy } from './BaseStrategy';
import { Server } from '../models/Server';
import { ServerCluster } from '../models/ServerCluster';
import { StrategyInitializationConfig } from '../types';
import { logger } from '../utils/logger';

/**
 * Least Connections load balancing strategy.
 * Selects the target server inside the cluster with the minimum number of active concurrent requests.
 */
export class LeastConnections extends BaseStrategy {
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
    logger.info(`Least Connections strategy initialized with ${noOfServers} servers.`);
  }

  public route(cluster: ServerCluster): number {
    const { servers } = cluster;
    if (servers.length === 0) {
      logger.warn('Least Connections strategy not initialized or server list empty.');
      return -1;
    }

    // Node.js Event Loop handles this check-then-act block synchronously and atomically.
    let selectedServer: Server | null = null;
    let minConnections = Infinity;

    for (const server of servers) {
      if (server.getHealth()) {
        const activeConnections = server.getActiveConnections();
        if (activeConnections < minConnections) {
          minConnections = activeConnections;
          selectedServer = server;
        }
      }
    }

    if (!selectedServer) {
      logger.error('No healthy servers available for Least Connections strategy.');
      return -1;
    }

    return selectedServer.assignRequest();
  }
}
