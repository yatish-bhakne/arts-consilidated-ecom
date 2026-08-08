import { logger } from '../src/logger';
import { prisma } from '../src/lib/prisma';
import { esClient, PRODUCTS_INDEX, ensureProductsIndex, waitForElasticsearch } from '../src/search/esClient';
import type { ProductDocument } from '../src/search/productsIndexMapping';
import { fetchAllProducts, type DummyJsonProduct } from './dummyjsonClient';

async function waitForMysql(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return;
    } catch (err) {
      logger.warn({ attempt, retries, err }, 'mysql not ready yet, retrying');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`MySQL did not become ready after ${retries} attempts`);
}

async function upsertCategories(products: DummyJsonProduct[]): Promise<Map<string, number>> {
  const names = [...new Set(products.map((p) => p.category))];
  const nameToId = new Map<string, number>();

  for (const name of names) {
    const category = await prisma.category.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    nameToId.set(name, category.id);
  }

  logger.info({ count: names.length }, 'upserted categories');
  return nameToId;
}

async function upsertProduct(product: DummyJsonProduct, categoryId: number): Promise<void> {
  const shared = {
    title: product.title,
    description: product.description,
    categoryId,
    price: product.price,
    discountPercentage: product.discountPercentage,
    rating: product.rating,
    stock: product.stock,
    brand: product.brand ?? null,
    sku: product.sku,
    weight: product.weight,
    width: product.dimensions.width,
    height: product.dimensions.height,
    depth: product.dimensions.depth,
    warrantyInformation: product.warrantyInformation ?? null,
    shippingInformation: product.shippingInformation ?? null,
    availabilityStatus: product.availabilityStatus,
    returnPolicy: product.returnPolicy ?? null,
    minimumOrderQuantity: product.minimumOrderQuantity,
    thumbnail: product.thumbnail,
  };

  const images = product.images.map((url, position) => ({ url, position }));
  const tags = [...new Set(product.tags)].map((tag) => ({ tag }));
  const reviews = product.reviews.map((review) => ({
    rating: review.rating,
    comment: review.comment,
    reviewerName: review.reviewerName,
    reviewerEmail: review.reviewerEmail,
    reviewedAt: new Date(review.date),
  }));

  await prisma.product.upsert({
    where: { id: product.id },
    create: {
      id: product.id,
      ...shared,
      images: { create: images },
      tags: { create: tags },
      reviews: { create: reviews },
    },
    update: {
      ...shared,
      images: { deleteMany: {}, create: images },
      tags: { deleteMany: {}, create: tags },
      reviews: { deleteMany: {}, create: reviews },
    },
  });
}

function toSearchDocument(product: DummyJsonProduct): ProductDocument {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: product.category,
    brand: product.brand ?? null,
    sku: product.sku,
    tags: product.tags,
    price: product.price,
    discountPercentage: product.discountPercentage,
    rating: product.rating,
    stock: product.stock,
    thumbnail: product.thumbnail,
  };
}

async function indexProducts(products: DummyJsonProduct[]): Promise<void> {
  const operations = products.flatMap((product) => [
    { index: { _index: PRODUCTS_INDEX, _id: String(product.id) } },
    toSearchDocument(product),
  ]);

  const response = await esClient.bulk({ refresh: true, operations });
  if (response.errors) {
    const failed = response.items.filter((item) => item.index?.error);
    logger.error({ failed }, 'elasticsearch bulk index reported errors');
    throw new Error(`Elasticsearch bulk index failed for ${failed.length} document(s)`);
  }

  logger.info({ count: products.length }, 'indexed products into elasticsearch');
}

async function main(): Promise<void> {
  logger.info('waiting for mysql and elasticsearch');
  await Promise.all([waitForMysql(), waitForElasticsearch()]);

  logger.info('fetching products from dummyjson');
  const products = await fetchAllProducts();
  logger.info({ count: products.length }, 'fetched products');

  const categoryIds = await upsertCategories(products);

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (categoryId === undefined) {
      throw new Error(`No category id resolved for product ${product.id} (${product.category})`);
    }
    await upsertProduct(product, categoryId);
  }
  logger.info({ count: products.length }, 'upserted products into mysql');

  await ensureProductsIndex();
  await indexProducts(products);

  logger.info('seed complete');
}

main()
  .catch((err) => {
    logger.error({ err }, 'seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await esClient.close();
  });
