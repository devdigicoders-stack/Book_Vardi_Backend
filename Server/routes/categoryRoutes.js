import express from 'express';
import Category from '../models/Category.js';
import authenticateToken from '../middlewares/auth.js';
import { cacheMiddleware, clearCache } from '../utils/cache.js';

const router = express.Router();

const DEFAULT_CATEGORIES = [
  {
    name: 'School Uniform',
    slug: 'school-uniform',
    description: 'School uniforms, readymade apparel, unstitched fabric, winter wear & sports wear',
    gstPercentage: 5,
    icon: 'Shirt',
    sortOrder: 1,
    subCategories: [
      { name: 'Ready to wear', slug: 'ready-to-wear' },
      { name: 'Unstitched', slug: 'unstitched' },
      { name: 'Winter wear', slug: 'winter-wear' },
      { name: 'Sports Wear', slug: 'sports-wear' }
    ]
  },
  {
    name: 'Books',
    slug: 'books',
    description: 'NCERT textbooks, private publisher reference books, practice & olympiad workbooks',
    gstPercentage: 0,
    icon: 'BookOpen',
    sortOrder: 2,
    subCategories: [
      { name: 'NCERT Books', slug: 'ncert-books' },
      { name: 'Private Publisher Book', slug: 'private-publisher-book' },
      { name: 'Practice & Olympiad Books', slug: 'practice-olympiad-books' }
    ]
  },
  {
    name: 'Notebook & Stationary',
    slug: 'notebook-stationary',
    description: 'School notebooks, registers, general stationary supplies, drawing and craft tools',
    gstPercentage: 12,
    icon: 'Edit3',
    sortOrder: 3,
    subCategories: [
      { name: 'Notebooks and Register', slug: 'notebooks-and-register' },
      { name: 'General Stationary', slug: 'general-stationary' },
      { name: 'Drawing and supplies', slug: 'drawing-and-supplies' }
    ]
  },
  {
    name: 'Footwear',
    slug: 'footwear',
    description: 'School uniform shoes, socks and athletic footwear',
    gstPercentage: 12,
    icon: 'Footprints',
    sortOrder: 4,
    subCategories: [
      { name: 'School shoes', slug: 'school-shoes' },
      { name: 'School Socks', slug: 'school-socks' }
    ]
  },
  {
    name: 'School Bags And Kit',
    slug: 'school-bags-and-kit',
    description: 'Ergonomic school bags, backpacks, student combos and complete school kits',
    gstPercentage: 18,
    icon: 'ShoppingBag',
    sortOrder: 5,
    subCategories: [
      { name: 'School Bags', slug: 'school-bags' },
      { name: 'Kit and Bundle', slug: 'kit-and-bundle' }
    ]
  }
];

async function ensureDefaultCategories() {
  let categories = await Category.find().sort({ sortOrder: 1, createdAt: 1 });
  if (categories.length === 0) {
    try {
      await Category.insertMany(DEFAULT_CATEGORIES);
      categories = await Category.find().sort({ sortOrder: 1, createdAt: 1 });
    } catch (e) {
      console.error('Error auto-seeding categories:', e);
    }
  }
  return categories;
}

// Get all categories (Public for header and store browsing)
router.get('/', cacheMiddleware(120), async (req, res) => {
  try {
    const categories = await ensureDefaultCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get category tree with subcategories (Public)
router.get('/tree', cacheMiddleware(120), async (req, res) => {
  try {
    const categories = await ensureDefaultCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create category
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, gstPercentage, icon, accentColor, bgColor, subCategories, imageUrl, sortOrder } = req.body;
    const category = new Category({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description,
      gstPercentage: gstPercentage !== undefined ? Number(gstPercentage) : 5,
      icon,
      accentColor,
      bgColor,
      subCategories: Array.isArray(subCategories)
        ? subCategories.map(s => typeof s === 'string' ? { name: s, slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : s)
        : [],
      imageUrl,
      sortOrder: sortOrder || 0
    });
    await category.save();
    clearCache('categor');
    clearCache('product');
    res.status(201).json({ message: 'Category created successfully', category });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update category
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    if (updates.subCategories && Array.isArray(updates.subCategories)) {
      updates.subCategories = updates.subCategories.map(s => typeof s === 'string' ? { name: s, slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : s);
    }
    const category = await Category.findByIdAndUpdate(id, updates, { new: true });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    clearCache('categor');
    res.json({ message: 'Category updated successfully', category });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete category
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    clearCache('categor');
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;