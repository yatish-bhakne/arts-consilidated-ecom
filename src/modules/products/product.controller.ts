import type { Request, Response } from 'express';
import { productService } from './product.service';
import type { ListProductsQuery, ProductIdParam } from './product.schema';

export const productController = {
  async list(req: Request, res: Response): Promise<void> {
    const { page, limit, query, category } = req.query as unknown as ListProductsQuery;
    const result = await productService.list({
      page,
      limit,
      ...(query ? { query } : {}),
      ...(category ? { category } : {}),
    });
    res.status(200).json(result);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params as unknown as ProductIdParam;
    const product = await productService.getById(id);
    res.status(200).json(product);
  },
};
