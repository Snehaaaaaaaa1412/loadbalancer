import http from 'http';
import { Request, Response } from 'express';
import { logger } from './logger';

/**
 * Handles Layer-7 HTTP request proxying by streaming incoming payload chunks
 * to a selected backend target server and piping the response stream back.
 */
export const forwardRequest = (targetUrl: string, req: Request, res: Response): void => {
  const url = new URL(targetUrl);
  
  // Standard L7 Reverse Proxy headers mapping
  const headers = {
    ...req.headers,
    'host': url.host,
    'x-forwarded-for': req.ip || req.socket.remoteAddress || '',
    'x-forwarded-proto': req.protocol,
    'x-forwarded-host': req.headers['host'] || '',
  };

  // Extract the target sub-path and query parameters relative to the gateway prefix
  const prefixPattern = /^\/api\/loadbalancer\/route\/[^/]+/;
  const targetPath = req.originalUrl.replace(prefixPattern, '') || '/';

  const options: http.RequestOptions = {
    hostname: url.hostname,
    port: url.port || 80,
    path: targetPath,
    method: req.method,
    headers: headers,
    timeout: 10000, // 10s default gateway timeout
  };

  logger.debug(`Proxying L7 request: ${req.method} ${req.originalUrl} -> ${targetUrl}${targetPath}`);

  const proxyReq = http.request(options, (proxyRes) => {
    // Write headers and status code back to client
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    
    // Pipe response stream chunks to avoid loading bodies in memory
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err: any) => {
    logger.error(`L7 Proxy routing error targeting ${targetUrl}: ${err.message}`);
    
    if (res.headersSent) return;

    if (err.code === 'ECONNREFUSED') {
      res.status(502).json({ error: 'Bad Gateway', message: `Target mock server at ${targetUrl} is offline.` });
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
      res.status(504).json({ error: 'Gateway Timeout', message: 'The mock server took too long to respond.' });
    } else {
      res.status(500).json({ error: 'Internal Server Error', message: 'Proxy request routing failed.' });
    }
  });

  proxyReq.on('timeout', () => {
    logger.warn(`Proxy routing timeout triggered targeting ${targetUrl}`);
    proxyReq.destroy();
  });

  // Stream client request body payload (e.g. POST data) to backend socket
  req.pipe(proxyReq);
};
