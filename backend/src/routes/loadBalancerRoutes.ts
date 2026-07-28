import { Router } from 'express';
import { LoadBalancerController } from '../controllers/LoadBalancerController';
import { validateStrategyParam, validateInitialization } from '../middlewares/requestValidator';

import { LoadBalancerService } from '../services/LoadBalancerService';

const router = Router();
export const service = new LoadBalancerService();
const controller = new LoadBalancerController(service);

// Route configuration mapping
router.post(
  '/initialize/:strategy/:noOfServers',
  validateStrategyParam,
  validateInitialization,
  controller.initialize
);

router.post(
  '/request/:strategy',
  validateStrategyParam,
  controller.handleRequest
);

router.get(
  '/servers/:strategy',
  validateStrategyParam,
  controller.getServers
);

// L7 Reverse Proxy catch-all routing mapping
router.all(
  '/route/:strategy/*',
  validateStrategyParam,
  controller.proxyRequest
);

export default router;
