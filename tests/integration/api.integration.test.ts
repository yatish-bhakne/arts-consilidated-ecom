import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

// Runs against the real, already-seeded MySQL + Elasticsearch from
// `docker compose up` (ports published to localhost — see package.json's
// test:integration script for the DATABASE_URL/ELASTICSEARCH_NODE it sets).
// No mocking: per our conventions doc, a passing mocked integration test
// that doesn't catch a real schema/query mismatch is worse than no test.

let app: Express;

beforeAll(async () => {
  const { createApp } = await import('../../src/app');
  app = createApp();
});

afterAll(async () => {
  const { prisma } = await import('../../src/lib/prisma');
  const { esClient } = await import('../../src/search/esClient');
  await prisma.$disconnect();
  await esClient.close();
});

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /categories', () => {
  it('lists all seeded categories', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body).toContainEqual(expect.objectContaining({ name: 'beauty' }));
  });
});

describe('GET /products', () => {
  it('paginates the full MySQL-backed listing', async () => {
    const res = await request(app).get('/products').query({ limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.total).toBe(194);
    expect(res.body.limit).toBe(5);
    expect(res.body.page).toBe(1);
  });

  const invalidQueries = [
    { name: 'limit above the cap', query: { limit: 500 } },
    { name: 'limit of zero', query: { limit: 0 } },
    { name: 'non-numeric page', query: { page: 'abc' } },
  ];

  it.each(invalidQueries)('rejects: $name', async ({ query }) => {
    const res = await request(app).get('/products').query(query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /products/:id', () => {
  it('returns full detail for a known seeded product', async () => {
    const res = await request(app).get('/products/1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Essence Mascara Lash Princess');
    expect(res.body.category).toBe('beauty');
    expect(Array.isArray(res.body.images)).toBe(true);
    expect(Array.isArray(res.body.tags)).toBe(true);
  });

  it('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get('/products/999999');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /products?query=', () => {
  it('finds a product via Elasticsearch full-text search', async () => {
    const res = await request(app).get('/products').query({ query: 'mascara' });
    expect(res.status).toBe(200);
    expect(res.body.data).toContainEqual(expect.objectContaining({ id: 1 }));
  });
});

describe('GET /products?category=', () => {
  it('filters via Elasticsearch and every result matches the category', async () => {
    const res = await request(app).get('/products').query({ category: 'beauty', limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const product of res.body.data) {
      expect(product.category).toBe('beauty');
    }
  });
});
