import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import { logger } from './logger';
import { requestId as requestIdMiddleware } from './middleware/requestId';
import { notFound as notFoundMiddleware } from './middleware/notFound';
import { errorHandler as errorHandlerMiddleware } from './middleware/errorHandler';
import { productsRouter } from './modules/products/product.routes';
import { categoriesRouter } from './modules/categories/category.routes';

export function createApp(): Express {
  const app = express();

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => {
        const existing = req.headers['x-request-id'];
        return typeof existing === 'string' ? existing : randomUUID();
      },
    }),
  );
  app.use(requestIdMiddleware);

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/products', productsRouter);
  app.use('/categories', categoriesRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
