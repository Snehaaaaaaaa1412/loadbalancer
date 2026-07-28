import { BaseStrategy } from './BaseStrategy';
import { RoundRobin } from './RoundRobin';
import { LeastConnections } from './LeastConnections';
import { WeightedRoundRobin } from './WeightedRoundRobin';

/**
 * Type representing a class constructor that implements BaseStrategy.
 */
export type StrategyConstructor = new () => BaseStrategy;

/**
 * Single source of truth registry mapping algorithm name keys to their concrete class types.
 * Allows the HTTP validation layer to inspect registered strategies without instantiating objects.
 */
export const StrategyRegistry: Record<string, StrategyConstructor> = {
  'round-robin': RoundRobin,
  'weightedroundrobin': WeightedRoundRobin,
  'least-connections': LeastConnections,
};
export type StrategyRegistryKeys = keyof typeof StrategyRegistry;
