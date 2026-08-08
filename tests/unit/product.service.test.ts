import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Paginated } from '../../src/lib/pagination';
import type { ProductDetail, ProductSummary } from '../../src/modules/products/product.types';

// Hoisted above the imports below by vitest — the real repository/search
// modules (and everything they transitively import: Prisma, the ES client,
// env validation) never actually execute in this test.
vi.mock('../../src/modules/products/product.repository', () => ({
  productRepository: { findMany: vi.fn(), findById: vi.fn() },
}));
vi.mock('../../src/modules/products/product.search', () => ({
  productSearch: { search: vi.fn() },
}));

import { productService } from '../../src/modules/products/product.service';
import { productRepository } from '../../src/modules/products/product.repository';
import { productSearch } from '../../src/modules/products/product.search';
import { NotFoundError } from '../../src/errors/AppError';

const emptyResult: Paginated<ProductSummary> = {
  data: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

describe('productService.list — MySQL vs Elasticsearch routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(productRepository.findMany).mockResolvedValue(emptyResult);
    vi.mocked(productSearch.search).mockResolvedValue(emptyResult);
  });

  const cases = [
    { name: 'no filters -> MySQL', params: { page: 1, limit: 20 }, wantRepository: true },
    {
      name: 'query only -> Elasticsearch',
      params: { page: 1, limit: 20, query: 'phone' },
      wantRepository: false,
    },
    {
      name: 'category only -> Elasticsearch',
      params: { page: 1, limit: 20, category: 'beauty' },
      wantRepository: false,
    },
    {
      name: 'query and category together -> Elasticsearch',
      params: { page: 1, limit: 20, query: 'phone', category: 'beauty' },
      wantRepository: false,
    },
  ];

  it.each(cases)('$name', async ({ params, wantRepository }) => {
    await productService.list(params);

    expect(productRepository.findMany).toHaveBeenCalledTimes(wantRepository ? 1 : 0);
    expect(productSearch.search).toHaveBeenCalledTimes(wantRepository ? 0 : 1);
  });
});

describe('productService.getById', () => {
  const sampleProduct: ProductDetail = {
    id: 1,
    title: 'Essence Mascara',
    category: 'beauty',
    price: 9.99,
    discountPercentage: 10.48,
    rating: 2.56,
    stock: 99,
    brand: 'Essence',
    thumbnail: 'https://example.com/thumb.webp',
    description: 'A mascara.',
    sku: 'BEA-001',
    weight: 4,
    dimensions: { width: 15, height: 13, depth: 23 },
    warrantyInformation: '1 week warranty',
    shippingInformation: 'Ships in 3-5 business days',
    availabilityStatus: 'In Stock',
    returnPolicy: 'No return policy',
    minimumOrderQuantity: 48,
    images: ['https://example.com/1.webp'],
    tags: ['beauty', 'mascara'],
    reviews: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the product when the repository finds it', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(sampleProduct);
    await expect(productService.getById(1)).resolves.toEqual(sampleProduct);
  });

  it('throws NotFoundError when the repository returns null', async () => {
    vi.mocked(productRepository.findById).mockResolvedValue(null);
    await expect(productService.getById(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});
