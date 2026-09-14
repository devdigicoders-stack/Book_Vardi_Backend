import express from "express";
import School from "../models/School.js";
import SchoolBulkOrder from "../models/SchoolBulkOrder.js";

const router = express.Router();

// GET all partner schools
router.get("/", async (req, res) => {
  try {
    const schools = await School.find();
    res.json({ success: true, schools });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single school by ID
router.get("/:id", async (req, res) => {
  try {
    const school = await School.findById(req.params.id);
    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }
    res.json({ success: true, school });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST submit a new School Bulk Order inquiry
router.post("/bulk-order", async (req, res) => {
  try {
    const {
      referenceId,
      institutionName,
      schoolId,
      institutionType,
      contactName,
      contactEmail,
      contactPhone,
      designation,
      address,
      city,
      state,
      pincode,
      requirements,
      totalQuantity,
      targetDeliveryDate,
      logoEmbroideryRequired,
      targetBudgetPerKit,
      additionalNotes
    } = req.body;

    if (!institutionName || !contactName || !contactEmail || !contactPhone || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required institution, contact administrator, and location fields."
      });
    }

    const refCode = referenceId || `BULK-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const bulkOrder = new SchoolBulkOrder({
      referenceId: refCode,
      institutionName,
      schoolId: schoolId || "",
      institutionType: institutionType || "K-12 School",
      contactName,
      contactEmail,
      contactPhone,
      designation: designation || "Administrator",
      address: address || "",
      city,
      state,
      pincode,
      requirements: Array.isArray(requirements) ? requirements : [],
      totalQuantity: Number(totalQuantity) || 0,
      targetDeliveryDate: targetDeliveryDate || "",
      logoEmbroideryRequired: Boolean(logoEmbroideryRequired),
      targetBudgetPerKit: targetBudgetPerKit || "",
      additionalNotes: additionalNotes || "",
      status: "pending"
    });

    await bulkOrder.save();

    res.status(201).json({
      success: true,
      message: "School Bulk Order inquiry submitted successfully!",
      referenceId: bulkOrder.referenceId,
      bulkOrder
    });
  } catch (error) {
    console.error("School Bulk Order submission error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET all School Bulk Orders (Admin view)
router.get("/bulk-orders/list", async (req, res) => {
  try {
    const orders = await SchoolBulkOrder.find().sort({ createdAt: -1 });
    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
