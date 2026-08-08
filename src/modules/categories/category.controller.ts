import type { Request, Response } from 'express';
import { categoryService } from './category.service';

export const categoryController = {
  async list(_req: Request, res: Response): Promise<void> {
    const categories = await categoryService.list();
    res.status(200).json(categories);
  },
};
