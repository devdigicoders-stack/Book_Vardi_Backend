import Category from "../models/Category.js";
import Product from "../models/Product.js";
import Kit from "../models/Kit.js";
import School from "../models/School.js";

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

const DEFAULT_KITS = [
  {
    title: "DPS Class 5 Complete Academic Kit",
    schoolName: "Delhi Public School",
    schoolCode: "DPS",
    gender: "Unisex",
    classGrade: "Class 5",
    badgeTag: "Best Seller",
    items: [
      { name: "DPS Summer Uniform Shirt", quantity: 2, unitPrice: 350, totalPrice: 700 },
      { name: "NCERT Class 5 All Subjects Set", quantity: 1, unitPrice: 650, totalPrice: 650 },
      { name: "Class 5 Notebook Bundle (10 Pcs)", quantity: 1, unitPrice: 400, totalPrice: 400 },
      { name: "Camlin Geometry & Stationery Set", quantity: 1, unitPrice: 250, totalPrice: 250 }
    ],
    totalMrp: 2000,
    bundlePrice: 1699,
    savingsAmount: 301,
    discountPercentage: 15,
    stock: 40,
    images: ["https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80"],
    description: "Everything your child needs for Class 5 at DPS: Uniforms, NCERT Books, Notebooks & Premium Stationery.",
    rating: 4.9,
    ratingCount: 184,
    status: "available"
  },
  {
    title: "Kendriya Vidyalaya Class 8 All-in-One Kit",
    schoolName: "Kendriya Vidyalaya",
    schoolCode: "KV",
    gender: "Unisex",
    classGrade: "Class 8",
    badgeTag: "Verified KV",
    items: [
      { name: "KV Official Uniform Sweater & Shirt", quantity: 1, unitPrice: 850, totalPrice: 850 },
      { name: "NCERT Class 8 Textbook Set (6 Books)", quantity: 1, unitPrice: 580, totalPrice: 580 },
      { name: "Class 8 Long Notebooks (8 Pcs)", quantity: 1, unitPrice: 360, totalPrice: 360 },
      { name: "Exam Essentials Pen & Geometry Kit", quantity: 1, unitPrice: 210, totalPrice: 210 }
    ],
    totalMrp: 2000,
    bundlePrice: 1599,
    savingsAmount: 401,
    discountPercentage: 20,
    stock: 35,
    images: ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&auto=format&fit=crop&q=80"],
    description: "Full academic kit curated for Kendriya Vidyalaya Class 8 students with books, notebooks & uniform.",
    rating: 4.8,
    ratingCount: 142,
    status: "available"
  },
  {
    title: "Primary School Creative Art & Stationery Starter Kit",
    schoolName: "Any School",
    schoolCode: "GEN",
    gender: "Unisex",
    classGrade: "Class 1-5",
    badgeTag: "Special Offer",
    items: [
      { name: "Magic Water Coloring Book", quantity: 1, unitPrice: 299, totalPrice: 299 },
      { name: "Pastel Highlighters (6 Colors)", quantity: 1, unitPrice: 199, totalPrice: 199 },
      { name: "Smooth Gel Pen Pack (10 Pcs)", quantity: 1, unitPrice: 249, totalPrice: 249 },
      { name: "A4 Spiral Sketchbook 100 GSM", quantity: 1, unitPrice: 180, totalPrice: 180 }
    ],
    totalMrp: 927,
    bundlePrice: 699,
    savingsAmount: 228,
    discountPercentage: 25,
    stock: 50,
    images: ["https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=500&auto=format&fit=crop&q=80"],
    description: "Vibrant art activity & writing essentials bundle for creative primary students.",
    rating: 5.0,
    ratingCount: 96,
    status: "available"
  }
];

const DEFAULT_SCHOOLS = [
  {
    schoolId: "SCH-001",
    name: "Delhi Public School, R.K. Puram",
    shortName: "Delhi Public School",
    code: "DPS",
    board: "CBSE",
    city: "New Delhi",
    address: "Sector 12, R.K. Puram, New Delhi",
    pincode: "110022",
    lat: 28.5684,
    lng: 77.1834,
    classes: "Nursery to 12th",
    studentCount: 4200,
    contactPerson: "Mrs. Sunita Chawla",
    email: "admin@dpsrkp.net",
    phone: "+91 11 2617 1267",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-002",
    name: "The Mother’s International School",
    shortName: "The Mother’s International School",
    code: "MIS",
    board: "CBSE",
    city: "New Delhi",
    address: "Sri Aurobindo Marg, Vijay Mandal Enclave, New Delhi",
    pincode: "110016",
    lat: 28.5398,
    lng: 77.1994,
    classes: "Class 1 to 12th",
    studentCount: 2600,
    contactPerson: "Dr. Arvind Menon",
    email: "principal@mis.org.in",
    phone: "+91 11 2652 4810",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-003",
    name: "St. Xavier Senior Secondary School",
    shortName: "St. Xavier Senior Secondary",
    code: "STX",
    board: "ICSE",
    city: "Gurugram, Haryana",
    address: "Sector 49, Rosewood City, Gurugram, Haryana",
    pincode: "122018",
    lat: 28.4195,
    lng: 77.0566,
    classes: "KG to 12th",
    studentCount: 3100,
    contactPerson: "Fr. Matthew D’Souza",
    email: "contact@stxaviersgurugram.in",
    phone: "+91 124 405 9182",
    status: "Partner Active",
    exclusiveKit: false
  },
  {
    schoolId: "SCH-004",
    name: "Kendriya Vidyalaya No. 1",
    shortName: "Kendriya Vidyalaya",
    code: "KV",
    board: "CBSE",
    city: "Pune, Maharashtra",
    address: "Ganeshkhind Road, Armament Colony, Pune, Maharashtra",
    pincode: "411007",
    lat: 18.5402,
    lng: 73.8340,
    classes: "Class 1 to 12th",
    studentCount: 1850,
    contactPerson: "Mr. Satish Waghmare",
    email: "kv1pune@kvsedu.gov.in",
    phone: "+91 20 2634 1190",
    status: "Partner Active",
    exclusiveKit: true
  },
  {
    schoolId: "SCH-005",
    name: "Modern School, Barakhamba Road",
    shortName: "Modern School, Barakhamba",
    code: "MSB",
    board: "CBSE",
    city: "New Delhi",
    address: "Barakhamba Road, Connaught Place, New Delhi",
    pincode: "110001",
    lat: 28.6304,
    lng: 77.2285,
    classes: "Class 6 to 12th",
    studentCount: 2900,
    contactPerson: "Col. Rajesh Verma",
    email: "admin@modernschool.net",
    phone: "+91 11 2331 1618",
    status: "Partner Active",
    exclusiveKit: true
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

    const kitCount = await Kit.countDocuments();
    if (kitCount === 0) {
      await Kit.insertMany(DEFAULT_KITS);
      console.log("🌱 [AUTO-SEED] Initial kits seeded successfully.");
    }

    const schoolCount = await School.countDocuments();
    if (schoolCount === 0) {
      await School.insertMany(DEFAULT_SCHOOLS);
      console.log("🌱 [AUTO-SEED] Initial schools seeded successfully.");
    }
  } catch (error) {
    console.error("⚠️ [AUTO-SEED ERROR]:", error.message);
  }
};
