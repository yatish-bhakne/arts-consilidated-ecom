/**
 * Domain shapes owned by this module — never `@prisma/client`'s generated
 * types. Repositories (MySQL) and search (ES) both translate into these, so
 * the service/controller layers are indifferent to which store answered.
 */
export interface ProductSummary {
  id: number;
  title: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  brand: string | null;
  thumbnail: string;
}

export interface ProductReview {
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerEmail: string;
  reviewedAt: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  sku: string;
  weight: number;
  dimensions: { width: number; height: number; depth: number };
  warrantyInformation: string | null;
  shippingInformation: string | null;
  availabilityStatus: string;
  returnPolicy: string | null;
  minimumOrderQuantity: number;
  images: string[];
  tags: string[];
  reviews: ProductReview[];
}

export interface ListProductsParams {
  page: number;
  limit: number;
  query?: string;
  category?: string;
}
