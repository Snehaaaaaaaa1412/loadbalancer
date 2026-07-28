import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { StrategyRegistry } from '../algorithms/StrategyRegistry';

/**
 * Validates that the requested strategy is supported by the gateway router.
 */
export const validateStrategyParam = (req: Request, _res: Response, next: NextFunction): void => {
  const { strategy } = req.params;
  if (!strategy) {
    return next(new AppError('Strategy route parameter is required.', 400));
  }

  const normalized = strategy.toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(StrategyRegistry, normalized)) {
    return next(new AppError(`Strategy '${strategy}' is not registered or supported by the gateway.`, 400));
  }

  next();
};

/**
 * Validates initialization configurations (server count ranges, weight array types).
 */
export const validateInitialization = (req: Request, _res: Response, next: NextFunction): void => {
  const { noOfServers } = req.params;
  const numServers = parseInt(noOfServers, 10);

  if (isNaN(numServers) || numServers <= 0 || numServers > 50) {
    return next(new AppError('Number of servers must be a positive integer between 1 and 50.', 400));
  }

  const { strategy } = req.params;
  if (strategy.toLowerCase() === 'weightedroundrobin') {
    const { weights } = req.body || {};
    if (!weights || !Array.isArray(weights)) {
      return next(new AppError('A valid JSON body containing a "weights" array of integers is required for weighted round robin.', 400));
    }
    if (weights.length !== numServers) {
      return next(new AppError(`The weights array size (${weights.length}) must match the number of servers requested (${numServers}).`, 400));
    }
    for (let i = 0; i < weights.length; i++) {
      const weight = weights[i];
      if (typeof weight !== 'number' || weight <= 0 || !Number.isInteger(weight)) {
        return next(new AppError(`Weight at index ${i} (${weight}) must be a positive integer.`, 400));
      }
    }
  }

  next();
};
