import { env } from '../src/config/env';

export interface DummyJsonReview {
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
  reviewerEmail: string;
}

export interface DummyJsonProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string;
  sku: string;
  weight: number;
  dimensions: { width: number; height: number; depth: number };
  warrantyInformation?: string;
  shippingInformation?: string;
  availabilityStatus: string;
  reviews: DummyJsonReview[];
  returnPolicy?: string;
  minimumOrderQuantity: number;
  images: string[];
  thumbnail: string;
}

interface DummyJsonProductsResponse {
  products: DummyJsonProduct[];
  total: number;
  skip: number;
  limit: number;
}

const PAGE_SIZE = 100;

/**
 * Fetches the full product catalog via explicit skip/limit pagination
 * rather than relying on dummyjson's `limit=0` ("give me everything")
 * behaviour, which isn't part of its documented contract.
 */
export async function fetchAllProducts(): Promise<DummyJsonProduct[]> {
  const products: DummyJsonProduct[] = [];
  let skip = 0;

  for (;;) {
    const url = new URL('/products', env.DUMMYJSON_BASE_URL);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('skip', String(skip));

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`dummyjson request failed: ${res.status} ${res.statusText}`);
    }
    const page = (await res.json()) as DummyJsonProductsResponse;
    products.push(...page.products);

    skip += page.products.length;
    if (page.products.length === 0 || skip >= page.total) {
      break;
    }
  }

  return products;
}
