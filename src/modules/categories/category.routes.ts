import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { categoryController } from './category.controller';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  asyncHandler((req, res) => categoryController.list(req, res)),
);
