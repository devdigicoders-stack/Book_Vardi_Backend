import Cart from "../models/Cart.js";

// Helper to get or create cart for user
const getOrCreateCart = async (userId, userPhone) => {
  const query = [];
  if (userId) query.push({ userId });
  if (userPhone) query.push({ userPhone });

  let cart = null;
  if (query.length > 0) {
    cart = await Cart.findOne({ $or: query });
  }

  if (!cart) {
    cart = await Cart.create({
      userId: userId || null,
      userPhone: userPhone || "",
      items: [],
      totalAmount: 0
    });
  }

  return cart;
};

// 1. Get User Cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || req.query.phone;

    if (!userId && !userPhone) {
      return res.json({ success: true, cart: { items: [], totalAmount: 0 } });
    }

    const cart = await getOrCreateCart(userId, userPhone);
    return res.json({ success: true, cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch cart", error: error.message });
  }
};

// 2. Add Item to Cart
export const addToCart = async (req, res) => {
  try {
    const { product, productId, quantity = 1, phone } = req.body;
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || phone;

    const itemProduct = product || {};
    const itemNumId = itemProduct.id || productId;

    if (!itemNumId) {
      return res.status(400).json({ message: "Product details or ID required" });
    }

    let cart = await getOrCreateCart(userId, userPhone);

    const strId = String(itemNumId);
    const existingIndex = cart.items.findIndex(
      (it) => String(it.id || it.productId) === strId
    );

    const qtyToAdd = Number(quantity) > 0 ? Number(quantity) : 1;

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += qtyToAdd;
    } else {
      cart.items.push({
        id: itemProduct.id || itemNumId,
        productId: itemProduct.id || itemNumId,
        name: itemProduct.name || "Stationery Item",
        subtitle: itemProduct.subtitle || "",
        image: itemProduct.image || "",
        price: itemProduct.price || 0,
        originalPrice: itemProduct.originalPrice || 0,
        quantity: qtyToAdd
      });
    }

    await cart.save();
    return res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add to cart", error: error.message });
  }
};

// 3. Update Cart Item Quantity
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity, delta, phone } = req.body;
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || phone;

    let cart = await getOrCreateCart(userId, userPhone);
    const strId = String(itemId);

    const itemIndex = cart.items.findIndex(
      (it) => String(it.id || it.productId || it._id) === strId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (delta !== undefined) {
      const newQty = cart.items[itemIndex].quantity + Number(delta);
      if (newQty > 0) {
        cart.items[itemIndex].quantity = newQty;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    } else if (quantity !== undefined) {
      const newQty = Number(quantity);
      if (newQty > 0) {
        cart.items[itemIndex].quantity = newQty;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    }

    await cart.save();
    return res.json({ message: "Cart updated", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update cart", error: error.message });
  }
};

// 4. Remove Item from Cart
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"];

    let cart = await getOrCreateCart(userId, userPhone);
    const strId = String(itemId);

    cart.items = cart.items.filter(
      (it) => String(it.id || it.productId || it._id) !== strId
    );

    await cart.save();
    return res.json({ message: "Item removed from cart", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove item", error: error.message });
  }
};

// 5. Clear Entire Cart
export const clearCart = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers["x-user-id"] || req.body?.userId;
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || req.body?.phone || req.body?.userPhone;

    let cart = await getOrCreateCart(userId, userPhone);
    cart.items = [];
    await cart.save();

    return res.json({ message: "Cart cleared", cart });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear cart", error: error.message });
  }
};
