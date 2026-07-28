import { Request, Response, NextFunction } from 'express';
import { LoadBalancerService } from '../services/LoadBalancerService';
import { forwardRequest } from '../utils/proxy';
import { AppError } from '../middlewares/errorHandler';

/**
 * Controller handling REST routing requests for the load balancer endpoints.
 * Keeps routes clean and delegates core tasks to the service layer.
 */
export class LoadBalancerController {
  private readonly service: LoadBalancerService;

  constructor(service: LoadBalancerService) {
    this.service = service;
  }

  /**
   * Configures a load balancing strategy.
   */
  public initialize = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { strategy, noOfServers } = req.params;
      const numServers = parseInt(noOfServers, 10);
      const { weights } = req.body || {};

      this.service.initializeStrategy(strategy, numServers, weights);

      res.status(200).send(`Initialized ${strategy} load balancer with ${numServers} servers.`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Processes a simulated client request and routes it.
   */
  public handleRequest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { strategy } = req.params;
      const serverId = this.service.routeRequest(strategy);
      res.status(200).json(serverId);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Retrieves server states for dashboard metric lookups.
   */
  public getServers = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { strategy } = req.params;
      const serverStates = this.service.getServerStates(strategy);
      res.status(200).json(serverStates);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Receives real incoming client request and reverse-proxies it to the selected target backend server.
   */
  public proxyRequest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { strategy } = req.params;
      const serverId = this.service.routeRequest(strategy);

      if (serverId === -1) {
        throw new AppError('Gateway Overloaded: All backend targets are at full capacity.', 503);
      }

      // Generate host target address
      const targetUrl = `http://localhost:808${serverId}`;

      // Forward request using L7 reverse proxy streaming
      forwardRequest(targetUrl, req, res);
    } catch (error) {
      next(error);
    }
  };
}
