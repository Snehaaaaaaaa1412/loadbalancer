import { BaseStrategy } from './BaseStrategy';
import { StrategyRegistry } from './StrategyRegistry';

/**
 * Factory class for managing and instantiating load balancing strategy singletons.
 * Loads strategy definitions dynamically from the StrategyRegistry on demand.
 */
export class StrategyFactory {
  private static readonly instances: Map<string, BaseStrategy> = new Map();

  /**
   * Retrieves the strategy instance corresponding to the given algorithm key name.
   * Instantiates and caches the strategy lazily on first access.
   */
  public static getStrategy(strategyName: string): BaseStrategy {
    const normalized = strategyName.toLowerCase();
    
    // Return cached instance if available
    let instance = StrategyFactory.instances.get(normalized);
    if (instance) {
      return instance;
    }

    // Lookup constructor in the registry
    const StrategyClass = StrategyRegistry[normalized];
    if (!StrategyClass) {
      throw new Error(`Strategy '${strategyName}' is not registered or supported by the factory.`);
    }

    // Instantiates, caches, and returns singleton instance
    instance = new StrategyClass();
    StrategyFactory.instances.set(normalized, instance);
    return instance;
  }

  /**
   * Returns a list of all registered strategy names.
   */
  public static getAvailableStrategies(): string[] {
    return Object.keys(StrategyRegistry);
  }
}
