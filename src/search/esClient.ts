import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { logger } from '../logger';
import { PRODUCTS_INDEX_MAPPING } from './productsIndexMapping';

export const esClient = new Client({ node: env.ELASTICSEARCH_NODE });

export const PRODUCTS_INDEX = env.ELASTICSEARCH_PRODUCTS_INDEX;

/**
 * Idempotent: creates the index with our mapping if it doesn't exist yet.
 * Safe to call on every seed run — does nothing once the index is present.
 */
export async function ensureProductsIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: PRODUCTS_INDEX });
  if (exists) {
    logger.info({ index: PRODUCTS_INDEX }, 'elasticsearch index already exists');
    return;
  }
  await esClient.indices.create({
    index: PRODUCTS_INDEX,
    mappings: PRODUCTS_INDEX_MAPPING,
  });
  logger.info({ index: PRODUCTS_INDEX }, 'created elasticsearch index');
}

export async function waitForElasticsearch(retries = 30, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await esClient.cluster.health({ wait_for_status: 'yellow', timeout: '5s' });
      return;
    } catch (err) {
      logger.warn(
        { attempt, retries, err },
        'elasticsearch not ready yet, retrying',
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Elasticsearch did not become ready after ${retries} attempts`);
}
