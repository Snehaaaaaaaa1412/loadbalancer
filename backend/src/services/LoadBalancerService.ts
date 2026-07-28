import { StrategyFactory } from '../algorithms/StrategyFactory';
import { ServerCluster } from '../models/ServerCluster';
import { Server } from '../models/Server';
import { ServerState } from '../types';
import { logger } from '../utils/logger';
import { RedisClient } from '../controlplane/RedisClient';
import { VersionManager, VersionComparisonResult } from '../controlplane/VersionManager';

/**
 * Service orchestrator coordinating load balancing operations.
 * Manages ServerCluster states and coordinates stateless routing algorithms.
 */
export class LoadBalancerService {
  private readonly clusters: Map<string, ServerCluster> = new Map();
  private readonly versionManager = new VersionManager();

  /**
   * Retrieves or instantiates the ServerCluster instance for a specific strategy name.
   */
  private getOrCreateCluster(strategyName: string): ServerCluster {
    const key = strategyName.toLowerCase();
    let cluster = this.clusters.get(key);
    if (!cluster) {
      cluster = new ServerCluster();
      this.clusters.set(key, cluster);
    }
    return cluster;
  }

  /**
   * Configures and initializes server instances for the specified strategy.
   */
  public initializeStrategy(strategyName: string, noOfServers: number, weights?: number[]): void {
    logger.info(`Initializing strategy: '${strategyName}' with ${noOfServers} servers.`);
    const cluster = this.getOrCreateCluster(strategyName);
    const strategy = StrategyFactory.getStrategy(strategyName);
    strategy.initializeCluster(cluster, { noOfServers, weights });
  }

  /**
   * Distributes request and yields target server ID using chosen strategy.
   */
  public routeRequest(strategyName: string): number {
    const cluster = this.getOrCreateCluster(strategyName);
    const strategy = StrategyFactory.getStrategy(strategyName);
    const serverId = strategy.route(cluster);
    logger.debug(`Routed request via '${strategyName}' to Server ID: ${serverId}`);
    return serverId;
  }

  public getServerStates(strategyName: string): ServerState[] {
    const cluster = this.getOrCreateCluster(strategyName);
    return cluster.servers.map((server: Server) => server.toJSON());
  }

  /**
   * Performs an asynchronous reconciliation pull from Redis.
   * Fetches latest configuration, parses it, builds a new Cluster snapshot,
   * updates the local version, and executes an atomic pointer swap.
   * Incorporates randomized backoff to prevent thundering herd.
   */
  public async reconcileCluster(strategyName: string, targetVersion: number): Promise<void> {
    const key = strategyName.toLowerCase();
    
    // 1. Thundering Herd Mitigation: Apply randomized backoff jitter (0 to 100ms)
    const jitter = Math.random() * 100;
    await new Promise((resolve) => setTimeout(resolve, jitter));

    // Re-verify version under lock to ensure another event didn't process it during sleep
    const currentVersion = this.versionManager.getVersion(key);
    if (targetVersion <= currentVersion) {
      logger.debug(`Reconciliation skipped for ${strategyName}; version ${targetVersion} already met.`);
      return;
    }

    const redis = RedisClient.getInstance();
    if (!redis.isRedisEnabled()) return;

    const pub = redis.getCommandClient();
    if (!pub) {
      logger.error('Redis command client unavailable during reconciliation.');
      return;
    }

    try {
      const redisConfigKey = `lb:cluster:${key}:configs`;
      const redisVersionKey = `lb:cluster:${key}:version`;
      
      // 2. Pull configuration and version atomically
      const [configStr, fetchedVersionStr] = await Promise.all([
        pub.get(redisConfigKey),
        pub.get(redisVersionKey)
      ]);

      if (!configStr || !fetchedVersionStr) {
        logger.warn(`Redis configurations not found for cluster: ${key}`);
        return;
      }

      const fetchedVersion = parseInt(fetchedVersionStr, 10);

      // 3. Concurrency Protection: Avoid out-of-order downgrade
      const latestLocalVersion = this.versionManager.getVersion(key);
      if (fetchedVersion <= latestLocalVersion) {
        logger.warn(`Fetched version (${fetchedVersion}) is obsolete. Local version is ${latestLocalVersion}.`);
        return;
      }

      // 4. Schema validation
      let newConfigs: { id: number; weight: number }[];
      try {
        newConfigs = JSON.parse(configStr);
        if (!Array.isArray(newConfigs)) {
          throw new Error('Config payload is not an array.');
        }
      } catch (err: any) {
        logger.error(`Failed to parse config schema from Redis: ${err.message}. Payload: ${configStr}`);
        return; // Fail open
      }

      // 5. Copy-on-Write Pointer Swap
      const oldCluster = this.clusters.get(key);
      const newCluster = ServerCluster.createFromConfig(newConfigs, oldCluster);
      this.clusters.set(key, newCluster);
      this.versionManager.setVersion(key, fetchedVersion);

      logger.info(`Reconciliation complete. Swapped cluster '${strategyName}' to Version: ${fetchedVersion}.`);
    } catch (err: any) {
      logger.error(`Critical error during control plane reconciliation: ${err.message}`);
    }
  }

  /**
   * Processes configuration events emitted by the Control Plane.
   */
  public async handleConfigUpdate(clusterName: string, incomingVersion: number, newConfigsJson?: string): Promise<void> {
    const key = clusterName.toLowerCase();
    const comparison = this.versionManager.compareVersion(key, incomingVersion);

    if (comparison === VersionComparisonResult.STALE) {
      logger.debug(`Stale config event ignored for ${clusterName} (Incoming: ${incomingVersion}, Local: ${this.versionManager.getVersion(key)})`);
      return;
    }

    if (comparison === VersionComparisonResult.INCREMENTAL) {
      // 1. Sequential update path: Try to apply payload if passed directly, otherwise fall back to pull
      if (newConfigsJson) {
        try {
          const newConfigs: { id: number; weight: number }[] = JSON.parse(newConfigsJson);
          const oldCluster = this.clusters.get(key);
          const newCluster = ServerCluster.createFromConfig(newConfigs, oldCluster);
          this.clusters.set(key, newCluster);
          this.versionManager.setVersion(key, incomingVersion);
          logger.info(`Applied incremental configuration update for '${clusterName}' to Version: ${incomingVersion}`);
          return;
        } catch (err: any) {
          logger.error(`Failed to parse incremental config payload: ${err.message}`);
        }
      }
    }

    // 2. Gap Detected or Failed Incremental: Trigger Pull Reconciliation
    logger.info(`Version gap or pull required for '${clusterName}' (Incoming: ${incomingVersion}, Local: ${this.versionManager.getVersion(key)}). Syncing...`);
    await this.reconcileCluster(clusterName, incomingVersion);
  }
}
