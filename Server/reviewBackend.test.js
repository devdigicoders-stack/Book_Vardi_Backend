import { describe, it, expect, vi } from 'vitest';
import Review from './models/Review.js';
import Product from './models/Product.js';
import { getAllReviews } from './controllers/reviewController.js';

describe('Review Controller - Backend Error Fixes', () => {
  it('handles non-ObjectId productIds without throwing CastError (GET /api/reviews)', async () => {
    const mockReviews = [
      { _id: '60c72b2f9b1d8c001f5f2a1a', productId: 'PROD-101', userName: 'John', rating: 5, comment: 'Great', status: 'approved' },
      { _id: '60c72b2f9b1d8c001f5f2a1b', productId: '60c72b2f9b1d8c001f5f2a99', userName: 'Jane', rating: 4, comment: 'Nice', status: 'pending' }
    ];

    vi.spyOn(Review, 'find').mockReturnValue({
      sort: vi.fn().mockResolvedValue(mockReviews)
    });

    vi.spyOn(Product, 'find').mockReturnValue({
      select: vi.fn().mockResolvedValue([])
    });

    const req = {};
    const res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis()
    };

    await getAllReviews(req, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const result = res.json.mock.calls[0][0];
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0].productId).toBe('PROD-101');
  });
});
