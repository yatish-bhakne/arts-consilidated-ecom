import { categoryRepository } from './category.repository';
import type { Category } from './category.types';

export const categoryService = {
  async list(): Promise<Category[]> {
    return categoryRepository.findAll();
  },
};
