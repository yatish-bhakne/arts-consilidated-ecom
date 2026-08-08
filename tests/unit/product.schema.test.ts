import { describe, expect, it } from 'vitest';
import {
  listProductsQuerySchema,
  productIdParamSchema,
} from '../../src/modules/products/product.schema';

describe('listProductsQuerySchema', () => {
  const validCases = [
    { name: 'defaults applied when empty', input: {}, want: { page: 1, limit: 20 } },
    {
      name: 'page and limit coerced from query-string values',
      input: { page: '2', limit: '50' },
      want: { page: 2, limit: 50 },
    },
    {
      name: 'query is trimmed',
      input: { query: '  phone  ' },
      want: { page: 1, limit: 20, query: 'phone' },
    },
  ];

  it.each(validCases)('accepts: $name', ({ input, want }) => {
    const result = listProductsQuerySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject(want);
    }
  });

  const invalidCases = [
    { name: 'limit above the 100 cap', input: { limit: '101' } },
    { name: 'limit of zero', input: { limit: '0' } },
    { name: 'page of zero', input: { page: '0' } },
    { name: 'empty query string', input: { query: '' } },
    { name: 'non-numeric page', input: { page: 'abc' } },
  ];

  it.each(invalidCases)('rejects: $name', ({ input }) => {
    const result = listProductsQuerySchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('productIdParamSchema', () => {
  it('coerces a numeric string id to a number', () => {
    const result = productIdParamSchema.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(42);
    }
  });

  const invalidCases = [
    { name: 'zero', input: { id: '0' } },
    { name: 'negative', input: { id: '-1' } },
    { name: 'non-numeric', input: { id: 'abc' } },
    { name: 'decimal', input: { id: '1.5' } },
  ];

  it.each(invalidCases)('rejects: $name', ({ input }) => {
    const result = productIdParamSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
