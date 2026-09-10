import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";

// 1. Get User Wishlist
export const getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ userId: req.user.id }).populate(
      "products",
      "name category price mrp discountPercentage images stock status rating sizes"
    );

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId: req.user.id, products: [] });
    }

    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch wishlist", error: error.message });
  }
};

// 2. Add / Toggle Wishlist Item
export const toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    let wishlist = await Wishlist.findOne({ userId: req.user.id });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: req.user.id, products: [] });
    }

    const index = wishlist.products.findIndex((p) => p.toString() === productId);
    let action = "added";

    if (index > -1) {
      wishlist.products.splice(index, 1);
      action = "removed";
    } else {
      wishlist.products.push(productId);
    }

    await wishlist.save();
    await wishlist.populate("products", "name category price mrp discountPercentage images stock status");

    res.json({ message: `Product ${action} to wishlist`, wishlist, action });
  } catch (error) {
    res.status(500).json({ message: "Failed to update wishlist", error: error.message });
  }
};

// 3. Remove item from Wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId: req.user.id });
    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    wishlist.products = wishlist.products.filter((p) => p.toString() !== productId);
    await wishlist.save();

    res.json({ message: "Product removed from wishlist", wishlist });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove from wishlist", error: error.message });
  }
};
