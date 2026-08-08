import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { validate } from '../../middleware/validate';
import { productController } from './product.controller';
import { listProductsQuerySchema, productIdParamSchema } from './product.schema';

export const productsRouter = Router();

productsRouter.get(
  '/',
  validate('query', listProductsQuerySchema),
  asyncHandler((req, res) => productController.list(req, res)),
);

productsRouter.get(
  '/:id',
  validate('params', productIdParamSchema),
  asyncHandler((req, res) => productController.getById(req, res)),
);
