import Cart from "../models/Cart.js";

// Helper to extract product ID as string
const extractCartItemId = (item) => {
  if (item === null || item === undefined) return null;
  if (typeof item === 'object') {
    return String(item.id || item.productId || item._id || '');
  }
  return String(item);
};

// Helper to get or create cart for user
const getOrCreateCart = async (userId, userPhone) => {
  const query = [];
  if (userId) {
    query.push({ userId });
    query.push({ userId: String(userId) });
  }
  if (userPhone && String(userPhone).trim()) {
    query.push({ userPhone: String(userPhone).trim() });
  }

  let cart = null;
  if (query.length > 0) {
    cart = await Cart.findOne({ $or: query });
  }

  if (!cart) {
    cart = await Cart.create({
      userId: userId || null,
      userPhone: userPhone ? String(userPhone).trim() : "",
      items: [],
      totalAmount: 0
    });
  } else {
    let updated = false;
    if (userId && !cart.userId) {
      cart.userId = userId;
      updated = true;
    }
    if (userPhone && !cart.userPhone) {
      cart.userPhone = String(userPhone).trim();
      updated = true;
    }
    if (updated) {
      await cart.save();
    }
  }

  return cart;
};

// Helper to sanitize and normalize cart items array
const getNormalizedCartItems = (cart) => {
  if (!cart || !Array.isArray(cart.items)) return [];
  return cart.items
    .map((it) => {
      if (typeof it !== 'object' || it === null) {
        if (it === undefined || it === null) return null;
        return {
          id: String(it),
          productId: String(it),
          name: "Stationery Item",
          subtitle: "",
          image: "",
          price: 0,
          originalPrice: 0,
          quantity: 1
        };
      }
      const rawId = it.id || it.productId || it._id;
      if (rawId === undefined || rawId === null) return null;
      return {
        ...it,
        id: rawId,
        productId: it.productId || rawId,
        name: it.name || "Stationery Item",
        subtitle: it.subtitle || "",
        image: it.image || (Array.isArray(it.images) && it.images[0]) || "",
        price: Number(it.price) || 0,
        originalPrice: Number(it.originalPrice) || 0,
        paymentMethodAllowed: it.paymentMethodAllowed || it.payment_method_allowed || "Both",
        paymentMethodsAllowed: Array.isArray(it.paymentMethodsAllowed) ? it.paymentMethodsAllowed : ["COD", "Online"],
        quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1
      };
    })
    .filter(Boolean);
};

// Helper to save cart document safely handling VersionError (Optimistic Concurrency Control)
const saveCartSafely = async (cart) => {
  try {
    cart.markModified('items');
    await cart.save();
    return cart;
  } catch (err) {
    if (err.name === 'VersionError' && cart && cart._id) {
      // Re-fetch latest document from MongoDB to get updated __v and save
      const latestCart = await Cart.findById(cart._id);
      if (latestCart) {
        latestCart.items = cart.items;
        latestCart.markModified('items');
        await latestCart.save();
        return latestCart;
      }
    }
    throw err;
  }
};

// 1. Get User Cart
export const getCart = async (req, res) => {
  try {
    const userId = req.body?.userId || req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || req.query?.phone || req.body?.phone;

    if (!userId && !userPhone) {
      return res.json({ success: true, cart: { items: [], totalAmount: 0 } });
    }

    let cart = await getOrCreateCart(userId, userPhone);
    const normalizedItems = getNormalizedCartItems(cart);

    if (JSON.stringify(cart.items) !== JSON.stringify(normalizedItems)) {
      cart.items = normalizedItems;
      cart = await saveCartSafely(cart);
    }

    return res.json({ success: true, cart });
  } catch (error) {
    console.error("Error in getCart:", error);
    return res.status(500).json({ message: "Failed to fetch cart", error: error.message });
  }
};

// 2. Add Item to Cart
export const addToCart = async (req, res) => {
  try {
    const { product, productId, quantity = 1, phone, userId: bodyUserId } = req.body;
    const userId = bodyUserId || req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || phone;

    const itemProduct = product || {};
    const itemNumId = productId !== undefined && productId !== null ? productId : (itemProduct.id || itemProduct._id);

    if (itemNumId === undefined || itemNumId === null) {
      return res.status(400).json({ message: "Product details or ID required" });
    }

    let cart = await getOrCreateCart(userId, userPhone);
    const strId = String(itemNumId);

    const items = getNormalizedCartItems(cart);
    const existingIndex = items.findIndex(
      (it) => extractCartItemId(it) === strId
    );

    const qtyToAdd = Number(quantity) > 0 ? Number(quantity) : 1;

    if (existingIndex > -1) {
      items[existingIndex].quantity += qtyToAdd;
      if (!items[existingIndex].name && itemProduct.name) {
        items[existingIndex].name = itemProduct.name;
      }
      if (!items[existingIndex].image) {
        items[existingIndex].image = itemProduct.image || (Array.isArray(itemProduct.images) && itemProduct.images[0]) || "";
      }
      if (!items[existingIndex].price && itemProduct.price) {
        items[existingIndex].price = Number(itemProduct.price) || 0;
      }
    } else {
      items.push({
        id: itemProduct.id || itemProduct._id || itemNumId,
        productId: itemProduct.productId || itemProduct.id || itemProduct._id || itemNumId,
        name: itemProduct.name || "Stationery Item",
        subtitle: itemProduct.subtitle || itemProduct.category || "",
        image: itemProduct.image || (Array.isArray(itemProduct.images) && itemProduct.images[0]) || "",
        price: Number(itemProduct.price) || 0,
        originalPrice: Number(itemProduct.originalPrice) || 0,
        quantity: qtyToAdd
      });
    }

    cart.items = items;
    cart = await saveCartSafely(cart);

    return res.status(200).json({ message: "Item added to cart", cart });
  } catch (error) {
    console.error("Error in addToCart:", error);
    return res.status(500).json({ message: "Failed to add to cart", error: error.message });
  }
};

// 3. Update Cart Item Quantity
export const updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity, delta, phone, userId: bodyUserId } = req.body;
    const userId = bodyUserId || req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || phone;

    let cart = await getOrCreateCart(userId, userPhone);
    const strId = String(itemId);

    const items = getNormalizedCartItems(cart);
    const itemIndex = items.findIndex(
      (it) => extractCartItemId(it) === strId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (delta !== undefined) {
      const newQty = items[itemIndex].quantity + Number(delta);
      if (newQty > 0) {
        items[itemIndex].quantity = newQty;
      } else {
        items.splice(itemIndex, 1);
      }
    } else if (quantity !== undefined) {
      const newQty = Number(quantity);
      if (newQty > 0) {
        items[itemIndex].quantity = newQty;
      } else {
        items.splice(itemIndex, 1);
      }
    }

    cart.items = items;
    cart = await saveCartSafely(cart);

    return res.json({ message: "Cart updated", cart });
  } catch (error) {
    console.error("Error in updateCartItem:", error);
    return res.status(500).json({ message: "Failed to update cart", error: error.message });
  }
};

// 4. Remove Item from Cart
export const removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.body?.userId || req.user?.id || req.headers["x-user-id"];
    const userPhone = req.user?.phone || req.headers["x-user-phone"] || req.body?.phone;

    let cart = await getOrCreateCart(userId, userPhone);
    const strId = String(itemId);

    const items = getNormalizedCartItems(cart);
    cart.items = items.filter(
      (it) => extractCartItemId(it) !== strId
    );

    cart = await saveCartSafely(cart);

    return res.json({ message: "Item removed from cart", cart });
  } catch (error) {
    console.error("Error in removeFromCart:", error);
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
    cart = await saveCartSafely(cart);

    return res.json({ message: "Cart cleared", cart });
  } catch (error) {
    console.error("Error in clearCart:", error);
    return res.status(500).json({ message: "Failed to clear cart", error: error.message });
  }
};
