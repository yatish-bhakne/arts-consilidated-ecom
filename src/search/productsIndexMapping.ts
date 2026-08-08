/**
 * Index documents are self-contained product summaries — everything a
 * /products list response needs — so a search/filter hit never requires a
 * second round-trip to MySQL. Only fields we actually filter, sort, or
 * aggregate on are `keyword`; free-text fields are `text` only (see
 * .claude/plans/ecom-api-plan.md for why title/description skip a keyword
 * sub-field).
 */
export const PRODUCTS_INDEX_MAPPING = {
  properties: {
    id: { type: 'integer' },
    title: { type: 'text' },
    description: { type: 'text' },
    category: { type: 'keyword' },
    brand: { type: 'text' },
    sku: { type: 'keyword' },
    tags: { type: 'text' },
    price: { type: 'float' },
    discountPercentage: { type: 'float' },
    rating: { type: 'float' },
    stock: { type: 'integer' },
    thumbnail: { type: 'keyword', index: false },
  },
} as const;

export interface ProductDocument {
  id: number;
  title: string;
  description: string;
  category: string;
  brand: string | null;
  sku: string;
  tags: string[];
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  thumbnail: string;
}
