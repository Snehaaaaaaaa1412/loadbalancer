import { BaseStrategy } from './BaseStrategy';
import { Server } from '../models/Server';
import { ServerCluster } from '../models/ServerCluster';
import { StrategyInitializationConfig } from '../types';
import { logger } from '../utils/logger';

/**
 * Smooth Weighted Round Robin (SWRR) load balancing strategy.
 * Implements NGINX's smooth weighted routing algorithm to distribute requests
 * proportionally according to configured server weights without clustering traffic.
 */
export class WeightedRoundRobin extends BaseStrategy {
  public initializeCluster(cluster: ServerCluster, config: StrategyInitializationConfig): void {
    const { noOfServers, weights } = config;
    if (noOfServers <= 0) {
      throw new Error('Number of servers must be greater than zero.');
    }

    if (weights && weights.length !== noOfServers) {
      throw new Error('Number of weights must match the number of servers.');
    }

    const serversList: Server[] = [];
    for (let i = 0; i < noOfServers; i++) {
      const weight = weights ? weights[i] : 1;
      serversList.push(new Server(i + 1, weight));
    }
    cluster.setServers(serversList);

    logger.info(`Smooth Weighted Round Robin strategy initialized with ${noOfServers} servers. Weights: [${weights || serversList.map(() => 1)}]`);
  }

  public route(cluster: ServerCluster): number {
    const { servers, currentWeights } = cluster;
    if (servers.length === 0) {
      logger.warn('Weighted Round Robin strategy not initialized or server list empty.');
      return -1;
    }

    let totalWeight = 0;
    let maxWeight = -Infinity;
    let selectedIndex = -1;

    // Step 1: Accumulate current weights by their configured static weights
    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      if (server.getHealth()) {
        const weight = server.getWeight();
        currentWeights[i] += weight;
        totalWeight += weight;

        // Select the server with the maximum current weight
        if (currentWeights[i] > maxWeight) {
          maxWeight = currentWeights[i];
          selectedIndex = i;
        }
      }
    }

    if (selectedIndex === -1) {
      logger.error('No healthy servers available for Weighted Round Robin strategy.');
      return -1;
    }

    // Step 2: Decrement the selected server's current weight by the sum of all weights
    currentWeights[selectedIndex] -= totalWeight;

    // Step 3: Route the request to the chosen server
    return servers[selectedIndex].assignRequest();
  }
}
