import Category from "../models/Category.js";
import Product from "../models/Product.js";

const DEFAULT_CATEGORIES = [
  {
    name: "SCHOOL UNIFORMS",
    slug: "uniforms",
    description: "Complete summer & winter school uniforms",
    accentColor: "var(--color-brand-blue)",
    bgColor: "var(--color-brand-blue-subtle)",
    icon: "Shirt",
    imageUrl: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=300&auto=format&fit=crop&q=80",
    productCount: 15,
    sortOrder: 1,
    subCategories: [
      { name: "Boys Summer", slug: "boys-summer" },
      { name: "Boys Winter", slug: "boys-winter" },
      { name: "Girls Summer", slug: "girls-summer" },
      { name: "Girls Winter", slug: "girls-winter" },
      { name: "Sports & PT", slug: "sports-pt" },
      { name: "House T-Shirts", slug: "house-tshirts" }
    ]
  },
  {
    name: "NCERT BOOKS",
    slug: "ncert",
    description: "Official NCERT textbooks Class 1 to 12th",
    accentColor: "var(--color-brand-teal)",
    bgColor: "var(--color-brand-teal-subtle)",
    icon: "BookOpen",
    imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=300&auto=format&fit=crop&q=80",
    productCount: 12,
    sortOrder: 2,
    subCategories: [
      { name: "Class 1-5", slug: "class-1-5" },
      { name: "Class 6-8", slug: "class-6-8" },
      { name: "Class 9-10", slug: "class-9-10" },
      { name: "Class 11-12", slug: "class-11-12" },
      { name: "Science & Math", slug: "science-math" },
      { name: "Humanities", slug: "humanities" }
    ]
  },
  {
    name: "PRACTICE BOOKS",
    slug: "practice_books",
    description: "Olympiad prep, workbooks & solved sample papers",
    accentColor: "var(--color-brand-ochre)",
    bgColor: "var(--color-brand-ochre-subtle)",
    icon: "BookMarked",
    imageUrl: "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=300&auto=format&fit=crop&q=80",
    productCount: 10,
    sortOrder: 3,
    subCategories: [
      { name: "Olympiad Prep", slug: "olympiad-prep" },
      { name: "Grammar Books", slug: "grammar-books" },
      { name: "Math Workbooks", slug: "math-workbooks" },
      { name: "Cursive Writing", slug: "cursive-writing" },
      { name: "Sample Papers", slug: "sample-papers" }
    ]
  },
  {
    name: "DRAWING FOR KIDS",
    slug: "drawing_books",
    description: "Magic coloring, sketchbooks & art activities",
    accentColor: "var(--color-brand-pink)",
    bgColor: "var(--color-brand-pink-subtle)",
    icon: "Palette",
    imageUrl: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=300&auto=format&fit=crop&q=80",
    productCount: 8,
    sortOrder: 4,
    subCategories: [
      { name: "Magic Coloring", slug: "magic-coloring" },
      { name: "Sketch Books", slug: "sketch-books" },
      { name: "Water Reveal", slug: "water-reveal" },
      { name: "Art Activity", slug: "art-activity" },
      { name: "Origami", slug: "origami" }
    ]
  },
  {
    name: "STATIONERY",
    slug: "supplies",
    description: "Pens, pencils, geometry boxes & notebooks",
    accentColor: "var(--color-brand-teal)",
    bgColor: "var(--color-brand-teal-subtle)",
    icon: "PenTool",
    imageUrl: "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&auto=format&fit=crop&q=80",
    productCount: 14,
    sortOrder: 5,
    subCategories: [
      { name: "Pens & Pencils", slug: "pens-pencils" },
      { name: "Geometry Boxes", slug: "geometry-boxes" },
      { name: "Notebooks", slug: "notebooks" },
      { name: "Lunch Boxes", slug: "lunch-boxes" },
      { name: "Water Bottles", slug: "water-bottles" }
    ]
  },
  {
    name: "KITS & BUNDLES",
    slug: "kits",
    description: "Complete academic kits & exam bundles",
    accentColor: "var(--color-brand-ochre)",
    bgColor: "var(--color-brand-ochre-subtle)",
    icon: "Package",
    imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&auto=format&fit=crop&q=80",
    productCount: 6,
    sortOrder: 6,
    subCategories: [
      { name: "Full Academic Kits", slug: "full-academic-kits" },
      { name: "Exam Revision", slug: "exam-revision" },
      { name: "Art Starter Kit", slug: "art-starter-kit" },
      { name: "Gift Hampers", slug: "gift-hampers" }
    ]
  }
];

const DEFAULT_PRODUCTS = [
  {
    name: "DPS Summer Uniform Set (Boys)",
    category: "uniforms",
    subCategory: "Boys Summer",
    schoolName: "Delhi Public School",
    schoolCode: "DPS",
    classGrade: "Class 1-5",
    gender: "Boy",
    price: 899,
    mrp: 1199,
    discountPercentage: 25,
    stock: 50,
    unit: "set",
    description: "White Cotton Shirt & Grey Shorts set for DPS students.",
    images: ["https://images.unsplash.com/photo-1593032465175-481ac7f401a0?w=500&auto=format&fit=crop&q=80"],
    tags: ["Best Seller", "School Approved"],
    averageRating: 4.9,
    numReviews: 1245,
    status: "available"
  },
  {
    name: "KV Winter Uniform Sweater (Unisex)",
    category: "uniforms",
    subCategory: "Unisex Winter",
    schoolName: "Kendriya Vidyalaya",
    schoolCode: "KV",
    classGrade: "Class 1-12",
    gender: "Unisex",
    price: 949,
    mrp: 1299,
    discountPercentage: 26,
    stock: 40,
    unit: "piece",
    description: "Navy Blue V-Neck warm woolen sweater for KV students.",
    images: ["https://plus.unsplash.com/premium_photo-1673356302067-aac3b545a362?w=500&auto=format&fit=crop&q=80"],
    tags: ["Best Seller", "Verified KV"],
    averageRating: 4.8,
    numReviews: 2153,
    status: "available"
  },
  {
    name: "NCERT Mathematics Class 10",
    category: "ncert",
    subCategory: "Class 9-10",
    schoolName: "Any School",
    classGrade: "Class 10",
    gender: "All",
    price: 160,
    mrp: 160,
    discountPercentage: 0,
    stock: 100,
    unit: "book",
    description: "Official NCERT Mathematics Textbook for Class 10 CBSE Board.",
    images: ["https://images.unsplash.com/photo-1592496001020-d31bd830651f?w=500&auto=format&fit=crop&q=80"],
    tags: ["Best Seller", "NCERT Official"],
    averageRating: 4.9,
    numReviews: 1782,
    status: "available"
  },
  {
    name: "Class 10 CBSE 10-Year Question Bank",
    category: "practice_books",
    subCategory: "Sample Papers",
    schoolName: "Any School",
    classGrade: "Class 10",
    gender: "All",
    price: 499,
    mrp: 650,
    discountPercentage: 23,
    stock: 30,
    unit: "book",
    offer: {
      hasOffer: true,
      discountType: "percentage",
      discountValue: 23,
      offerPrice: 499,
      isActive: true
    },
    description: "Complete previous year solved question papers for CBSE board exam.",
    images: ["https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500&auto=format&fit=crop&q=80"],
    tags: ["Special Offer", "Top Pick"],
    averageRating: 4.8,
    numReviews: 650,
    status: "available"
  },
  {
    name: "Precision Geometry Compass Box",
    category: "supplies",
    subCategory: "Geometry Boxes",
    schoolName: "Any School",
    classGrade: "Class 5-10",
    gender: "All",
    price: 249,
    mrp: 350,
    discountPercentage: 28,
    stock: 60,
    unit: "set",
    offer: {
      hasOffer: true,
      discountType: "percentage",
      discountValue: 28,
      offerPrice: 249,
      isActive: true
    },
    description: "Metallic geometry box with high precision divider and rulers.",
    images: ["https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=500&auto=format&fit=crop&q=80"],
    tags: ["Special Offer", "Best Seller"],
    averageRating: 4.8,
    numReviews: 275,
    status: "available"
  },
  {
    name: "Kids Magic Water Coloring Book",
    category: "drawing_books",
    subCategory: "Magic Coloring",
    schoolName: "Any School",
    classGrade: "Nursery to Class 3",
    gender: "All",
    price: 299,
    mrp: 499,
    discountPercentage: 40,
    stock: 45,
    unit: "book",
    offer: {
      hasOffer: true,
      discountType: "percentage",
      discountValue: 40,
      offerPrice: 299,
      isActive: true
    },
    description: "Reusable magic water coloring book for kids with refillable water pen.",
    images: ["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&auto=format&fit=crop&q=80"],
    tags: ["Special Offer", "Creative"],
    averageRating: 5.0,
    numReviews: 1317,
    status: "available"
  }
];

export const seedDatabaseIfEmpty = async () => {
  try {
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES);
      console.log("🌱 [AUTO-SEED] Initial categories & subcategories seeded successfully.");
    }

    const productCount = await Product.countDocuments();
    if (productCount === 0) {
      await Product.insertMany(DEFAULT_PRODUCTS);
      console.log("🌱 [AUTO-SEED] Initial products seeded successfully.");
    }
  } catch (error) {
    console.error("⚠️ [AUTO-SEED ERROR]:", error.message);
  }
};
