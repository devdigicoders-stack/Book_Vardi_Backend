import Wishlist from "../models/Wishlist.js";

// Helper to find or create wishlist for user
const getOrCreateWishlist = async (userId, userPhone) => {
  const query = [];
  if (userId) query.push({ userId });
  if (userPhone) query.push({ userPhone });

  let wishlist = null;
  if (query.length > 0) {
    wishlist = await Wishlist.findOne({ $or: query });
  }

  if (!wishlist) {
    wishlist = await Wishlist.create({
      userId: userId || null,
      userPhone: userPhone || "",
      products: [],
      items: []
    });
  }

  return wishlist;
};

// 1. Get User Wishlist
export const getWishlist = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || req.query.phone;

    if (!userId && !userPhone) {
      return res.json({ success: true, wishlist: { items: [] }, productIds: [] });
    }

    const wishlist = await getOrCreateWishlist(userId, userPhone);
    const rawItems = wishlist.items && wishlist.items.length > 0
      ? wishlist.items
      : wishlist.products.map(p => String(p._id || p));

    const productIds = rawItems.map(item => (isNaN(item) ? item : Number(item)));

    return res.json({
      success: true,
      wishlist,
      productIds
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch wishlist", error: error.message });
  }
};

// 2. Add / Toggle Wishlist Item
export const toggleWishlist = async (req, res) => {
  try {
    const { productId, phone } = req.body;
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || phone;

    if (productId === undefined || productId === null) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    let wishlist = await getOrCreateWishlist(userId, userPhone);

    const strId = String(productId);
    const existingList = wishlist.items && wishlist.items.length > 0
      ? wishlist.items.map(String)
      : wishlist.products.map(p => String(p._id || p));

    const index = existingList.findIndex((id) => id === strId);
    let action = "added";

    if (index > -1) {
      existingList.splice(index, 1);
      action = "removed";
    } else {
      existingList.push(strId);
      action = "added";
    }

    wishlist.items = existingList;
    wishlist.products = existingList;
    await wishlist.save();

    const finalProductIds = existingList.map(item => (isNaN(item) ? item : Number(item)));

    return res.json({
      message: `Product ${action} ${action === 'added' ? 'to' : 'from'} wishlist`,
      action,
      productIds: finalProductIds,
      wishlist
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update wishlist", error: error.message });
  }
};

// 3. Remove item from Wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"];

    let wishlist = await getOrCreateWishlist(userId, userPhone);
    const strId = String(productId);

    const existingList = wishlist.items && wishlist.items.length > 0
      ? wishlist.items.map(String)
      : wishlist.products.map(p => String(p._id || p));

    const filtered = existingList.filter((id) => id !== strId);
    wishlist.items = filtered;
    wishlist.products = filtered;

    await wishlist.save();

    const finalProductIds = filtered.map(item => (isNaN(item) ? item : Number(item)));

    return res.json({
      message: "Product removed from wishlist",
      action: "removed",
      productIds: finalProductIds,
      wishlist
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove from wishlist", error: error.message });
  }
};
