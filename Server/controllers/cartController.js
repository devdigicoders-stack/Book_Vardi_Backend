import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// 1. Get User Cart
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate(
      "items.productId",
      "name category price mrp images stock status sizes ages ageGroup colors"
    );

    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cart", error: error.message });
  }
};

// 2. Add Item to Cart
export const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, size = "", age = "", color = "" } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ message: `Insufficient stock. Only ${product.stock} available.` });
    }

    const effectivePrice = product.offer?.hasOffer && product.offer?.offerPrice ? product.offer.offerPrice : product.price;

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    // Check if same item with same variant (size/age/color) exists
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        (item.size || "") === size &&
        (item.age || "") === age &&
        (item.color || "") === color
    );

    if (existingItemIndex > -1) {
      const newQty = cart.items[existingItemIndex].quantity + Number(quantity);
      if (product.stock < newQty) {
        return res.status(400).json({ message: `Only ${product.stock} items available in stock.` });
      }
      cart.items[existingItemIndex].quantity = newQty;
      cart.items[existingItemIndex].price = effectivePrice;
    } else {
      cart.items.push({
        productId,
        quantity: Number(quantity),
        size,
        age,
        color,
        price: effectivePrice
      });
    }

    await cart.save();
    await cart.populate("items.productId", "name category price mrp images stock status");

    res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Failed to add to cart", error: error.message });
  }
};

// 3. Update Cart Item Quantity
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be at least 1" });
    }

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    const product = await Product.findById(item.productId);
    if (product && product.stock < quantity) {
      return res.status(400).json({ message: `Only ${product.stock} items available in stock.` });
    }

    item.quantity = Number(quantity);
    await cart.save();
    await cart.populate("items.productId", "name category price mrp images stock status");

    res.json({ message: "Cart updated", cart });
  } catch (error) {
    res.status(500).json({ message: "Failed to update cart", error: error.message });
  }
};

// 4. Remove Item from Cart
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((item) => item._id.toString() !== itemId);
    await cart.save();
    await cart.populate("items.productId", "name category price mrp images stock status");

    res.json({ message: "Item removed from cart", cart });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove item", error: error.message });
  }
};

// 5. Clear Entire Cart
export const clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }
    res.json({ message: "Cart cleared", cart: { userId: req.user.id, items: [], totalAmount: 0 } });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear cart", error: error.message });
  }
};
