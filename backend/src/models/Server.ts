import { ServerState } from '../types';
import { logger } from '../utils/logger';

/**
 * Lifecycle states of an upstream backend target server.
 */
export enum ServerLifecycleState {
  ACTIVE = 'ACTIVE',       // Serves active routing client requests
  DRAINING = 'DRAINING',   // Receives no new requests; processes in-flight requests
  REMOVED = 'REMOVED'      // Terminated; fully eligible for garbage collection
}

/**
 * Represents a simulated backend target server.
 * Encapsulates the processing latency simulation using non-blocking asynchronous timers.
 */
export class Server {
  private readonly id: number;
  private weight: number;
  private activeConnections: number;
  private isHealthy: boolean;
  private readonly url: string;
  private readonly activeTimers = new Set<NodeJS.Timeout>();
  private lifecycleState: ServerLifecycleState = ServerLifecycleState.ACTIVE;

  constructor(id: number, weight: number = 1) {
    this.id = id;
    this.weight = weight;
    this.activeConnections = 0;
    this.isHealthy = true;
    this.url = `http://localhost:808${id}`; // Generates logical mock host URLs
  }

  /**
   * Simulates routing a request to this server.
   * Increments the connection count and schedules an asynchronous cleanup callback to decrement it.
   */
  public assignRequest(processingDelayMs: number = 5000): number {
    this.activeConnections++;
    
    // Asynchronous processing simulation without blocking Node's main event loop
    const timer = setTimeout(() => {
      if (this.activeConnections > 0) {
        this.activeConnections--;
      }
      this.activeTimers.delete(timer);

      // Safe Cleanup Policy: Transition to REMOVED once connection count drains to 0
      if (this.lifecycleState === ServerLifecycleState.DRAINING && this.activeConnections === 0) {
        this.lifecycleState = ServerLifecycleState.REMOVED;
        this.clearActiveTimers();
        logger.info(`Draining server ID: ${this.id} reached 0 connections. Fully cleaned up.`);
      }
    }, processingDelayMs);

    this.activeTimers.add(timer);
    return this.id;
  }

  /**
   * Immediately clears all active timers to prevent event loop scheduling leaks
   * when servers are reconfigured, re-initialized, or deleted.
   */
  public clearActiveTimers(): void {
    this.activeTimers.forEach(clearTimeout);
    this.activeTimers.clear();
    this.activeConnections = 0;
  }

  /**
   * Updates only configuration properties of the server node, protecting runtime execution states.
   */
  public updateConfiguration(weight: number): void {
    if (weight <= 0) {
      throw new Error('Server weight must be a positive integer.');
    }
    this.weight = weight;
  }

  public getId(): number {
    return this.id;
  }

  public getWeight(): number {
    return this.weight;
  }

  public getActiveConnections(): number {
    return this.activeConnections;
  }

  public getHealth(): boolean {
    return this.isHealthy;
  }

  public setHealth(status: boolean): void {
    this.isHealthy = status;
  }

  public getLifecycleState(): ServerLifecycleState {
    return this.lifecycleState;
  }

  public setLifecycleState(state: ServerLifecycleState): void {
    this.lifecycleState = state;
  }

  /**
   * Returns a snapshot state object suitable for client transmission.
   */
  public toJSON(): ServerState {
    return {
      id: this.id,
      url: this.url,
      weight: this.weight,
      activeConnections: this.activeConnections,
      isHealthy: this.isHealthy,
    };
  }
}
