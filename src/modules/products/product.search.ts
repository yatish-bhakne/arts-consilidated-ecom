import { esClient, PRODUCTS_INDEX } from '../../search/esClient';
import type { ProductDocument } from '../../search/productsIndexMapping';
import { paginate, type Paginated } from '../../lib/pagination';
import type { ProductSummary } from './product.types';

function toSummary(doc: ProductDocument): ProductSummary {
  return {
    id: doc.id,
    title: doc.title,
    category: doc.category,
    price: doc.price,
    discountPercentage: doc.discountPercentage,
    rating: doc.rating,
    stock: doc.stock,
    brand: doc.brand,
    thumbnail: doc.thumbnail,
  };
}

export interface SearchProductsParams {
  page: number;
  limit: number;
  query?: string;
  category?: string;
}

export const productSearch = {
  async search({ page, limit, query, category }: SearchProductsParams): Promise<Paginated<ProductSummary>> {
    const filter = category ? [{ term: { category } }] : [];
    const must = query
      ? [{ multi_match: { query, fields: ['title', 'description', 'brand', 'tags'] } }]
      : [{ match_all: {} }];

    const result = await esClient.search<ProductDocument>({
      index: PRODUCTS_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must, filter } },
    });

    const total =
      typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total?.value ?? 0);
    const docs = result.hits.hits.map((hit) => hit._source).filter((doc): doc is ProductDocument => !!doc);

    return paginate(docs.map(toSummary), page, limit, total);
  },
};
