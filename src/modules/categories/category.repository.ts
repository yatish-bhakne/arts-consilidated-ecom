import { prisma } from '../../lib/prisma';
import type { Category } from './category.types';

export const categoryRepository = {
  async findAll(): Promise<Category[]> {
    return prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  },
};
