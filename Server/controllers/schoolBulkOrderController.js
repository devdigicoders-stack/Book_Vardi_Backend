import SchoolBulkOrder from "../models/SchoolBulkOrder.js";

// GET all B2B School Bulk Orders for Seller
export const getSellerSchoolOrders = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const orders = await SchoolBulkOrder.find({
      $or: [
        { sellerId: sellerId },
        { sellerId: null },
        { sellerId: { $exists: false } }
      ]
    }).sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch school bulk orders", error: error.message });
  }
};

// POST Create a new School Bulk Requirement Inquiry (Seller / Admin)
export const createSellerSchoolOrder = async (req, res) => {
  try {
    const sellerId = req.user.id;
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
      status: "Requirement Received"
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
    await SchoolBulkOrder.findByIdAndDelete(id);
    res.json({ success: true, message: "School bulk order deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete school bulk order", error: error.message });
  }
};
