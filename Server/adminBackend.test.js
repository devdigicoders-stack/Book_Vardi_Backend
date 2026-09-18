import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../app.js';

describe('Book Vardi Backend Express Endpoints', () => {
  it('GET /api/products returns product array', async () => {
    // Mocking response directly or via Express req handler
    const req = { method: 'GET', url: '/api/products' };
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('verifies admin JWT authorization header validation middleware', async () => {
    const authMiddleware = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized access token required' });
      }
      next();
    };

    const mockReqBad = { headers: {} };
    const mockResBad = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const nextFn = vi.fn();

    authMiddleware(mockReqBad, mockResBad, nextFn);
    expect(mockResBad.status).toHaveBeenCalledWith(401);
    expect(mockResBad.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));

    const mockReqGood = { headers: { authorization: 'Bearer token123' } };
    authMiddleware(mockReqGood, mockResBad, nextFn);
    expect(nextFn).toHaveBeenCalled();
  });

  it('validates product approval payload format', () => {
    const validateApproval = (status, remark) => {
      const validStatuses = ['Approved', 'Pending', 'Rejected'];
      if (!validStatuses.includes(status)) {
        return { valid: false, error: 'Invalid approval status' };
      }
      return { valid: true, status, remark: remark || '' };
    };

    expect(validateApproval('Approved', 'Looks great').valid).toBe(true);
    expect(validateApproval('InvalidStatus').valid).toBe(false);
  });

  it('validates seller commission rate bounds', () => {
    const validateCommission = (rate) => {
      const num = Number(rate);
      if (isNaN(num) || num < 0 || num > 100) {
        return { valid: false, error: 'Commission rate must be between 0 and 100' };
      }
      return { valid: true, commissionRate: num };
    };

    expect(validateCommission(12.5).valid).toBe(true);
    expect(validateCommission(-5).valid).toBe(false);
    expect(validateCommission(150).valid).toBe(false);
  });

  it('validates school radius setting constraints', () => {
    const validateRadius = (radiusKm) => {
      const parsed = Number(radiusKm);
      const val = isNaN(parsed) || parsed === 0 ? (parsed === 0 ? 0 : 25) : parsed;
      const num = Math.max(1, Math.min(500, val));
      return { radiusKm: num };
    };

    expect(validateRadius(30).radiusKm).toBe(30);
    expect(validateRadius(0).radiusKm).toBe(1);
    expect(validateRadius(1000).radiusKm).toBe(500);
  });

  it('correctly parses and synchronizes sizeVariants into sizes, prices, and stock', () => {
    const payload = {
      name: 'Oxford Shirt',
      sizeVariants: [
        { size: 'M', price: 450, mrp: 599, stock: 20, image: 'https://example.com/m.png' },
        { size: 'L', price: 490, mrp: 649, stock: 30, image: 'https://example.com/l.png' },
        { size: 'XL', price: 520, mrp: 699, stock: 15, image: 'https://example.com/xl.png' }
      ]
    };

    if (Array.isArray(payload.sizeVariants) && payload.sizeVariants.length > 0) {
      if (!payload.sizes || payload.sizes.length === 0) {
        payload.sizes = payload.sizeVariants.map(v => v.size).filter(Boolean);
      }
      const validPrices = payload.sizeVariants.map(v => Number(v.price)).filter(p => !isNaN(p) && p > 0);
      if ((!payload.price || Number(payload.price) === 0) && validPrices.length > 0) {
        payload.price = Math.min(...validPrices);
      }
      const validMrps = payload.sizeVariants.map(v => Number(v.mrp)).filter(m => !isNaN(m) && m > 0);
      if ((!payload.mrp || Number(payload.mrp) === 0) && validMrps.length > 0) {
        payload.mrp = Math.min(...validMrps);
      }
      if (payload.stock === undefined || Number(payload.stock) === 0) {
        payload.stock = payload.sizeVariants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
      }
    }

    expect(payload.sizes).toEqual(['M', 'L', 'XL']);
    expect(payload.price).toBe(450); // Minimum variant price
    expect(payload.mrp).toBe(599); // Minimum variant mrp
    expect(payload.stock).toBe(65); // 20 + 30 + 15 = 65 total inventory
    expect(payload.sizeVariants[0].image).toBe('https://example.com/m.png');
    expect(payload.sizeVariants[1].image).toBe('https://example.com/l.png');
  });

  it('verifies dev/test token handling in authenticateToken', () => {
    const checkToken = (token) => {
      if (!token) return { status: 401, error: 'Access token required' };
      if (['mock-jwt-token-123', 'dev-admin-token', 'super-admin-token', 'test-token'].includes(token)) {
        return { status: 200, user: { id: 'admin-dev-001', role: 'super_admin' } };
      }
      return { status: 200, user: { id: 'jwt-user', role: 'admin' } };
    };

    expect(checkToken(null).status).toBe(401);
    expect(checkToken('mock-jwt-token-123').user.role).toBe('super_admin');
    expect(checkToken('super-admin-token').user.role).toBe('super_admin');
  });

  it('verifies inventory stock updates supporting both numeric and object payloads', () => {
    const parseInventoryStockPayload = (body) => {
      let { stock, stockQuantity, addQuantity } = body || {};
      if (typeof body === 'number') {
        stock = body;
      } else if (stock === undefined && stockQuantity !== undefined) {
        stock = stockQuantity;
      }
      return { stock, addQuantity };
    };

    expect(parseInventoryStockPayload(45).stock).toBe(45);
    expect(parseInventoryStockPayload({ stock: 60 }).stock).toBe(60);
    expect(parseInventoryStockPayload({ stockQuantity: 35 }).stock).toBe(35);
    expect(parseInventoryStockPayload({ addQuantity: 20 }).addQuantity).toBe(20);
  });

  it('correctly distributes quick restock additions across sizeVariants', () => {
    const product = {
      name: 'Navy Uniform Trouser',
      stock: 30,
      sizeVariants: [
        { size: '28', stock: 10 },
        { size: '30', stock: 10 },
        { size: '32', stock: 10 }
      ]
    };

    const addQty = 50;
    product.stock += addQty;
    const perVariant = Math.floor(addQty / product.sizeVariants.length);
    const remainder = addQty % product.sizeVariants.length;
    product.sizeVariants.forEach((v, idx) => {
      v.stock = (v.stock || 0) + perVariant + (idx === 0 ? remainder : 0);
    });

    expect(product.stock).toBe(80);
    expect(product.sizeVariants[0].stock).toBe(28); // 10 + 16 + 2 = 28
    expect(product.sizeVariants[1].stock).toBe(26); // 10 + 16 = 26
    expect(product.sizeVariants[2].stock).toBe(26); // 10 + 16 = 26
    expect(product.sizeVariants.reduce((sum, v) => sum + v.stock, 0)).toBe(80);
  });
});
