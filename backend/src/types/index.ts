/**
 * Represents the current runtime state of a backend server instance.
 */
export interface ServerState {
  id: number;
  url: string;
  weight: number;
  activeConnections: number;
  isHealthy: boolean;
}

/**
 * Strategy types supported by the load balancer gateway.
 */
export type LoadBalancerStrategyType = 'round-robin' | 'weightedroundrobin' | 'least-connections';

/**
 * Configuration payload passed during load balancer strategy initialization.
 */
export interface StrategyInitializationConfig {
  noOfServers: number;
  weights?: number[];
}
