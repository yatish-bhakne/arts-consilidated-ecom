import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { paginate, type Paginated } from '../../lib/pagination';
import type { ProductDetail, ProductSummary } from './product.types';

const summaryInclude = {
  category: true,
} satisfies Prisma.ProductInclude;

type ProductWithCategory = Prisma.ProductGetPayload<{ include: typeof summaryInclude }>;

const detailInclude = {
  category: true,
  images: { orderBy: { position: 'asc' } },
  tags: true,
  reviews: true,
} satisfies Prisma.ProductInclude;

type ProductWithDetails = Prisma.ProductGetPayload<{ include: typeof detailInclude }>;

function toSummary(product: ProductWithCategory): ProductSummary {
  return {
    id: product.id,
    title: product.title,
    category: product.category.name,
    price: Number(product.price),
    discountPercentage: Number(product.discountPercentage),
    rating: Number(product.rating),
    stock: product.stock,
    brand: product.brand,
    thumbnail: product.thumbnail,
  };
}

function toDetail(product: ProductWithDetails): ProductDetail {
  return {
    ...toSummary(product),
    description: product.description,
    sku: product.sku,
    weight: Number(product.weight),
    dimensions: {
      width: Number(product.width),
      height: Number(product.height),
      depth: Number(product.depth),
    },
    warrantyInformation: product.warrantyInformation,
    shippingInformation: product.shippingInformation,
    availabilityStatus: product.availabilityStatus,
    returnPolicy: product.returnPolicy,
    minimumOrderQuantity: product.minimumOrderQuantity,
    images: product.images.map((image) => image.url),
    tags: product.tags.map((tag) => tag.tag),
    reviews: product.reviews.map((review) => ({
      rating: review.rating,
      comment: review.comment,
      reviewerName: review.reviewerName,
      reviewerEmail: review.reviewerEmail,
      reviewedAt: review.reviewedAt.toISOString(),
    })),
  };
}

export const productRepository = {
  async findMany(page: number, limit: number): Promise<Paginated<ProductSummary>> {
    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        include: summaryInclude,
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count(),
    ]);

    return paginate(rows.map(toSummary), page, limit, total);
  },

  async findById(id: number): Promise<ProductDetail | null> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: detailInclude,
    });
    return product ? toDetail(product) : null;
  },
};
