import { z } from 'zod';

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
});

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const productIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type ProductIdParam = z.infer<typeof productIdParamSchema>;
