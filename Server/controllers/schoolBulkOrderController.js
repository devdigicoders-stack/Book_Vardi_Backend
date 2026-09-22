import SchoolBulkOrder from "../models/SchoolBulkOrder.js";
import Seller from "../models/Seller.js";

// GET all School Bulk Orders for Admin
export const getAdminSchoolOrders = async (req, res) => {
  try {
    const orders = await SchoolBulkOrder.find()
      .populate("sellerId", "storeName name phone email businessName")
      .populate("invitedSellerIds", "storeName name phone email businessName")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch school bulk orders", error: error.message });
  }
};

// PATCH Admin Distribute Order (Option A: Direct, Option B: Selected, Option C: Broadcast)
export const distributeSchoolOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignmentMode, sellerId, invitedSellerIds } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    if (!["direct", "selected", "broadcast"].includes(assignmentMode)) {
      return res.status(400).json({ success: false, message: "Invalid assignment mode. Choose 'direct', 'selected', or 'broadcast'." });
    }

    bulkOrder.assignmentMode = assignmentMode;

    if (assignmentMode === "direct") {
      if (!sellerId) {
        return res.status(400).json({ success: false, message: "Seller ID is required for direct assignment." });
      }
      bulkOrder.sellerId = sellerId;
      bulkOrder.invitedSellerIds = [];
      bulkOrder.status = "assigned";
    } else if (assignmentMode === "selected") {
      if (!Array.isArray(invitedSellerIds) || invitedSellerIds.length === 0) {
        return res.status(400).json({ success: false, message: "Please select at least one seller to invite." });
      }
      bulkOrder.invitedSellerIds = invitedSellerIds;
      bulkOrder.sellerId = null;
      bulkOrder.status = "published";
    } else if (assignmentMode === "broadcast") {
      bulkOrder.sellerId = null;
      bulkOrder.invitedSellerIds = [];
      bulkOrder.status = "published";
    }

    await bulkOrder.save();

    const updatedOrder = await SchoolBulkOrder.findById(id)
      .populate("sellerId", "storeName name phone email businessName")
      .populate("invitedSellerIds", "storeName name phone email businessName");

    res.json({
      success: true,
      message: `School bulk order distributed successfully via ${assignmentMode} mode`,
      order: updatedOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to distribute school bulk order", error: error.message });
  }
};

// GET all B2B School Bulk Orders visible to a Seller
export const getSellerSchoolOrders = async (req, res) => {
  try {
    const sellerId = req.user.id;

    // A seller can see orders that are:
    // 1. Directly assigned to them (sellerId = sellerId)
    // 2. Invited specifically (invitedSellerIds contains sellerId)
    // 3. Broadcast to all (assignmentMode = 'broadcast')
    // 4. Legacy orders created by seller themselves
    const orders = await SchoolBulkOrder.find({
      $or: [
        { sellerId: sellerId },
        { invitedSellerIds: sellerId },
        { assignmentMode: "broadcast" },
        { assignmentMode: "unassigned" },
        { assignmentMode: { $exists: false } },
        { status: "published" },
        { status: "pending" }
      ]
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch seller school bulk orders", error: error.message });
  }
};

// POST Seller Accept Direct / Invited Bulk Order
export const acceptSchoolOrderDirect = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const seller = await Seller.findById(sellerId);
    const sellerName = seller ? (seller.storeName || seller.businessName || seller.name || "Seller") : "Seller";

    bulkOrder.sellerId = sellerId;
    bulkOrder.status = "assigned";
    await bulkOrder.save();

    res.json({
      success: true,
      message: `You have successfully accepted school bulk order #${bulkOrder.referenceId}`,
      order: bulkOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to accept school bulk order", error: error.message });
  }
};

// POST Seller Submit Quotation / Negotiation Proposal
export const submitSellerQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = req.user.id;
    const { quoteAmount, unitPrice, estimatedDeliveryDays, proposedDeliveryDate, notes } = req.body;

    if (!quoteAmount) {
      return res.status(400).json({ success: false, message: "Quote amount is required." });
    }

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const seller = await Seller.findById(sellerId);
    const sellerName = seller ? (seller.ownerName || seller.name || "Vendor") : "Vendor";
    const sellerStoreName = seller ? (seller.storeName || seller.businessName || "Store") : "Store";
    const sellerPhone = seller ? (seller.phone || "") : "";
    const sellerCity = seller ? (seller.city || "") : "";

    // Check if seller already submitted a quotation
    const existingIndex = bulkOrder.quotations.findIndex(
      q => String(q.sellerId) === String(sellerId)
    );

    const quoteObj = {
      sellerId,
      sellerName,
      sellerStoreName,
      sellerPhone,
      sellerCity,
      quoteAmount: Number(quoteAmount),
      unitPrice: Number(unitPrice) || 0,
      estimatedDeliveryDays: Number(estimatedDeliveryDays) || 7,
      proposedDeliveryDate: proposedDeliveryDate || "",
      notes: notes || "",
      status: "submitted",
      submittedAt: new Date()
    };

    if (existingIndex >= 0) {
      bulkOrder.quotations[existingIndex] = quoteObj;
    } else {
      bulkOrder.quotations.push(quoteObj);
    }

    bulkOrder.status = "quoted";
    await bulkOrder.save();

    res.json({
      success: true,
      message: `Quotation of ₹${Number(quoteAmount).toLocaleString()} submitted successfully!`,
      order: bulkOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to submit quotation", error: error.message });
  }
};

// POST Admin Approve Specific Seller Quotation
export const approveSellerQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const winningQuote = bulkOrder.quotations.id(quoteId);
    if (!winningQuote) {
      return res.status(404).json({ success: false, message: "Specified quotation not found." });
    }

    // Mark all quotes status
    bulkOrder.quotations.forEach(q => {
      if (String(q._id) === String(quoteId)) {
        q.status = "approved";
      } else {
        q.status = "rejected";
      }
    });

    bulkOrder.acceptedQuoteId = winningQuote._id;
    bulkOrder.sellerId = winningQuote.sellerId;
    bulkOrder.status = "quote_accepted";
    bulkOrder.targetBudgetPerKit = String(winningQuote.quoteAmount);

    await bulkOrder.save();

    res.json({
      success: true,
      message: `Approved quotation from ${winningQuote.sellerStoreName || winningQuote.sellerName}! Order assigned.`,
      order: bulkOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to approve seller quotation", error: error.message });
  }
};

// POST Create a new School Bulk Requirement Inquiry (Seller / Admin / Customer)
export const createSellerSchoolOrder = async (req, res) => {
  try {
    const sellerId = req.user?.id || null;
    const {
      institutionName,
      contactName,
      contactPhone,
      contactEmail,
      requirementSummary,
      quantity,
      estimatedBudget,
      quoteAmount,
      targetDeliveryDate,
      additionalNotes
    } = req.body;

    if (!institutionName || !contactName || !contactPhone) {
      return res.status(400).json({ message: "Institution name, contact person, and phone are required." });
    }

    const refId = `SCH-REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReq = new SchoolBulkOrder({
      referenceId: refId,
      institutionName,
      contactName,
      contactPhone,
      contactEmail: contactEmail || "school@institute.edu.in",
      city: req.body.city || "Delhi",
      state: req.body.state || "Delhi",
      pincode: req.body.pincode || "110001",
      totalQuantity: Number(quantity) || 100,
      targetBudgetPerKit: String(estimatedBudget || 1000),
      additionalNotes: requirementSummary || additionalNotes || "",
      targetDeliveryDate: targetDeliveryDate || "",
      sellerId: sellerId,
      status: sellerId ? "Requirement Received" : "pending"
    });

    await newReq.save();
    res.status(201).json({ success: true, message: "School bulk order created successfully", order: newReq });
  } catch (error) {
    res.status(500).json({ message: "Failed to create school bulk order", error: error.message });
  }
};

// PATCH Update Quote Amount & Status for School Bulk Requirement
export const updateSellerSchoolOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, quoteAmount, quantity, targetDeliveryDate, additionalNotes } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ message: "School bulk requirement request not found" });
    }

    if (bulkOrder.sellerId && String(bulkOrder.sellerId) !== String(req.user.id) && req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied. You can only update your own school bulk orders." });
    }

    if (status) bulkOrder.status = status;
    if (quantity) bulkOrder.totalQuantity = Number(quantity);
    if (targetDeliveryDate) bulkOrder.targetDeliveryDate = targetDeliveryDate;
    if (additionalNotes) bulkOrder.additionalNotes = additionalNotes;
    if (quoteAmount) bulkOrder.targetBudgetPerKit = String(quoteAmount);

    await bulkOrder.save();
    res.json({ success: true, message: "School bulk order updated successfully", order: bulkOrder });
  } catch (error) {
    res.status(500).json({ message: "Failed to update school bulk order", error: error.message });
  }
};

// DELETE School Bulk Requirement Request
export const deleteSellerSchoolOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ message: "School bulk requirement request not found" });
    }

    if (req.user?.role !== "admin") {
      // If it is assigned to someone else explicitly, prevent deletion
      const currentUserId = String(req.user?.id || req.seller?._id);
      if (bulkOrder.sellerId && String(bulkOrder.sellerId) !== currentUserId) {
        return res.status(403).json({ message: "Access denied. You can only delete your own school bulk orders." });
      }
    }

    await SchoolBulkOrder.findByIdAndDelete(id);
    res.json({ success: true, message: "School bulk order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete school bulk order", error: error.message });
  }
};
