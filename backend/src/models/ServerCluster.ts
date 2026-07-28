import { Server, ServerLifecycleState } from './Server';

/**
 * Encapsulates the state of an upstream target server cluster.
 * Holds active target nodes and dynamic routing variables (pointers, indexes, running weights)
 * to keep algorithms entirely stateless.
 */
export class ServerCluster {
  public servers: Server[] = [];
  public roundRobinIndex: number = 0;
  
  // Stores the dynamic running weights for the Smooth Weighted Round Robin (SWRR) algorithm
  public currentWeights: number[] = [];

  constructor(servers: Server[] = []) {
    this.setServers(servers);
  }

  /**
   * Resets and populates the server cluster, returning routing pointers to initial positions.
   */
  public setServers(servers: Server[]): void {
    // Clear pending timers on discarded servers to prevent memory leaks and garbage collector blocks
    this.servers.forEach(server => server.clearActiveTimers());

    this.servers = servers;
    this.roundRobinIndex = 0;
    this.currentWeights = servers.map(() => 0);
  }

  /**
   * Factory method to construct a new ServerCluster from configuration parameters
   * while reusing existing Server instances (O(N) lookup complexity) to preserve
   * active connections counts and event loop timers.
   * Discarded servers transition to DRAINING state and clean up reactively when connections hit 0.
   */
  public static createFromConfig(
    newConfigs: { id: number; weight: number }[],
    oldCluster?: ServerCluster
  ): ServerCluster {
    const serversList: Server[] = [];

    // Create an O(1) lookup index of existing servers from the previous snapshot
    const oldServerMap = new Map<number, Server>();
    if (oldCluster) {
      oldCluster.servers.forEach(s => oldServerMap.set(s.getId(), s));
    }

    newConfigs.forEach(cfg => {
      const existingServer = oldServerMap.get(cfg.id);
      if (existingServer) {
        // Safe configuration updates protecting active connection tracking
        existingServer.updateConfiguration(cfg.weight);
        existingServer.setLifecycleState(ServerLifecycleState.ACTIVE);
        serversList.push(existingServer);
        
        // Remove from map to track which old servers were discarded
        oldServerMap.delete(cfg.id);
      } else {
        serversList.push(new Server(cfg.id, cfg.weight));
      }
    });

    // Remaining servers in the map enter DRAINING lifecycle and clean up on request drainage
    oldServerMap.forEach(oldServer => {
      oldServer.setLifecycleState(ServerLifecycleState.DRAINING);
      
      if (oldServer.getActiveConnections() === 0) {
        oldServer.setLifecycleState(ServerLifecycleState.REMOVED);
        oldServer.clearActiveTimers();
      }
    });

    return new ServerCluster(serversList);
  }
}
