import Announcement from "../models/Announcement.js";

// Seed default announcement items if DB is empty
const defaultAnnouncements = [
  {
    text: "Free Delivery on Orders Over ₹99",
    badge: "FREE DELIVERY",
    link: "/offers",
    priority: 1,
    isActive: true,
    bgColor: "#0f766e",
    textColor: "#ffffff"
  },
  {
    text: "10% OFF First Order | Code: SCHOOL10",
    badge: "DISCOUNT",
    link: "/offers",
    priority: 2,
    isActive: true,
    bgColor: "#0f766e",
    textColor: "#ffffff"
  },
  {
    text: "7 Days Return & Exchange Assurance",
    badge: "TRUST",
    link: "/about-us",
    priority: 3,
    isActive: true,
    bgColor: "#0f766e",
    textColor: "#ffffff"
  }
];

// Get All Announcement Bar Items (Public & Admin)
export const getAnnouncements = async (req, res) => {
  try {
    let items = await Announcement.find().sort({ priority: 1, createdAt: -1 });

    // Seed defaults if empty
    if (items.length === 0) {
      items = await Announcement.insertMany(defaultAnnouncements);
    }

    const now = new Date();
    // Auto-disable expired items in DB
    const updates = [];
    for (const item of items) {
      if (item.expiryDate && new Date(item.expiryDate) <= now && item.isActive) {
        item.isActive = false;
        updates.push(item.save());
      }
    }
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    res.json({
      success: true,
      count: items.length,
      announcements: items.map(item => ({
        ...item.toObject(),
        isExpired: item.expiryDate ? new Date(item.expiryDate) <= now : false
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch announcements", error: error.message });
  }
};

// Create New Top Announcement Bar Item
export const createAnnouncement = async (req, res) => {
  try {
    const { text, badge, link, priority, isActive, expiryDate, bgColor, textColor } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Announcement message text is required." });
    }

    const announcement = new Announcement({
      text: text.trim(),
      badge: badge ? badge.trim() : "",
      link: link ? link.trim() : "",
      priority: Number(priority) || 1,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      bgColor: bgColor || "#0f766e",
      textColor: textColor || "#ffffff"
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      message: "Top Announcement Bar item created successfully.",
      announcement
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create announcement", error: error.message });
  }
};

// Update Announcement Bar Item (text, priority, active state, expiry date, etc.)
export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, badge, link, priority, isActive, expiryDate, bgColor, textColor } = req.body;

    const item = await Announcement.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Announcement item not found." });
    }

    if (text !== undefined) item.text = text.trim();
    if (badge !== undefined) item.badge = badge.trim();
    if (link !== undefined) item.link = link.trim();
    if (priority !== undefined) item.priority = Number(priority);
    if (isActive !== undefined) item.isActive = Boolean(isActive);
    if (expiryDate !== undefined) item.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (bgColor !== undefined) item.bgColor = bgColor;
    if (textColor !== undefined) item.textColor = textColor;

    await item.save();

    res.json({
      success: true,
      message: "Announcement item updated successfully.",
      announcement: item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update announcement", error: error.message });
  }
};

// Toggle Enable / Disable Announcement Item
export const toggleAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const item = await Announcement.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Announcement item not found." });
    }

    item.isActive = isActive !== undefined ? Boolean(isActive) : !item.isActive;
    await item.save();

    res.json({
      success: true,
      message: `Announcement item ${item.isActive ? "ENABLED" : "DISABLED"} successfully.`,
      announcement: item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to toggle announcement status", error: error.message });
  }
};

// Delete Announcement Item
export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await Announcement.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Announcement item not found." });
    }

    res.json({
      success: true,
      message: "Announcement item deleted successfully."
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete announcement", error: error.message });
  }
};
