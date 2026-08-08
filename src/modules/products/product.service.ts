import { NotFoundError } from '../../errors/AppError';
import type { Paginated } from '../../lib/pagination';
import { productRepository } from './product.repository';
import { productSearch } from './product.search';
import type { ListProductsParams, ProductDetail, ProductSummary } from './product.types';

export const productService = {
  /**
   * Plain listing is served from MySQL; a `query` or `category` filter is
   * served from Elasticsearch — see .claude/plans/ecom-api-plan.md for why.
   */
  async list(params: ListProductsParams): Promise<Paginated<ProductSummary>> {
    const { page, limit, query, category } = params;
    if (query || category) {
      return productSearch.search({
        page,
        limit,
        ...(query ? { query } : {}),
        ...(category ? { category } : {}),
      });
    }
    return productRepository.findMany(page, limit);
  },

  async getById(id: number): Promise<ProductDetail> {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${id} not found`);
    }
    return product;
  },
};
