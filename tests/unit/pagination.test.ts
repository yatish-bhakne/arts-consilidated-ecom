import { describe, expect, it } from 'vitest';
import { paginate } from '../../src/lib/pagination';

describe('paginate', () => {
  const cases = [
    { name: 'exact multiple of limit', total: 40, page: 1, limit: 20, wantTotalPages: 2 },
    { name: 'remainder rounds up', total: 41, page: 1, limit: 20, wantTotalPages: 3 },
    { name: 'zero results', total: 0, page: 1, limit: 20, wantTotalPages: 0 },
    { name: 'single item under one page', total: 1, page: 1, limit: 20, wantTotalPages: 1 },
  ];

  it.each(cases)('$name', ({ total, page, limit, wantTotalPages }) => {
    const data = ['a', 'b', 'c'];
    const result = paginate(data, page, limit, total);

    expect(result.totalPages).toBe(wantTotalPages);
    expect(result.data).toBe(data);
    expect(result.page).toBe(page);
    expect(result.limit).toBe(limit);
    expect(result.total).toBe(total);
  });
});
