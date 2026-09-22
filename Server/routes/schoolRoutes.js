import express from "express";
import School from "../models/School.js";
import SchoolBulkOrder from "../models/SchoolBulkOrder.js";
import { cacheMiddleware, clearCache } from "../utils/cache.js";

const router = express.Router();

const DEFAULT_CLASSES_ARRAY = [
  "Nursery", "LKG", "UKG", "Class 1", "Class 2", "Class 3",
  "Class 4", "Class 5", "Class 6", "Class 7", "Class 8",
  "Class 9", "Class 10", "Class 11", "Class 12"
];

function normalizeClasses(cls) {
  if (Array.isArray(cls) && cls.length > 0) return cls;
  if (typeof cls === "string" && cls.includes(",")) {
    return cls.split(",").map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_CLASSES_ARRAY;
}

// GET all partner schools with optional district/subdistrict filtering and pagination
router.get("/", cacheMiddleware(120), async (req, res) => {
  try {
    const { district, subdistrict, city, page, limit } = req.query;
    
    const query = {};
    if (district || subdistrict || city) {
      const conditions = [];
      if (district) {
        conditions.push({ district: new RegExp(district, "i") });
        conditions.push({ city: new RegExp(district, "i") });
        conditions.push({ address: new RegExp(district, "i") });
      }
      if (subdistrict) {
        conditions.push({ subdistrict: new RegExp(subdistrict, "i") });
        conditions.push({ address: new RegExp(subdistrict, "i") });
      }
      if (city) {
        conditions.push({ city: new RegExp(city, "i") });
      }
      if (conditions.length > 0) {
        query.$or = conditions;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 0; // 0 means return all if limit not explicitly specified

    const totalCount = await School.countDocuments(query);
    
    let schoolsQuery = School.find(query).sort({ createdAt: -1 });
    if (limitNum > 0) {
      schoolsQuery = schoolsQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
    }
    
    const rawSchools = await schoolsQuery;

    // Ensure MongoDB school records store classes as an array
    const schools = await Promise.all(
      rawSchools.map(async (sch) => {
        if (!Array.isArray(sch.classes)) {
          sch.classes = normalizeClasses(sch.classes);
          try {
            await sch.save();
          } catch (e) {}
        }
        return sch;
      })
    );

    res.json({
      success: true,
      schools,
      total: totalCount,
      page: pageNum,
      limit: limitNum > 0 ? limitNum : totalCount,
      hasMore: limitNum > 0 ? (pageNum * limitNum < totalCount) : false
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single school by ID
router.get("/:id", cacheMiddleware(120), async (req, res) => {
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

// POST create a new school (Admin onboarding)
router.post("/", async (req, res) => {
  try {
    const schoolData = req.body;
    if (!schoolData.name) {
      return res.status(400).json({ success: false, message: "School name is required." });
    }
    const school = new School({
      ...schoolData,
      status: schoolData.status || "Partner Active"
    });
    await school.save();
    clearCache("school");
    res.status(201).json({ success: true, message: "School created successfully", school });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT update a school
router.put("/:id", async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }
    clearCache("school");
    res.json({ success: true, message: "School updated successfully", school });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE a school
router.delete("/:id", async (req, res) => {
  try {
    const school = await School.findByIdAndDelete(req.params.id);
    if (!school) {
      return res.status(404).json({ success: false, message: "School not found" });
    }
    clearCache("school");
    res.json({ success: true, message: "School deleted successfully" });
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

    if (!institutionName || !contactName || !contactPhone) {
      return res.status(400).json({
        success: false,
        message: "Please fill required fields: Institution Name, Contact Person, and Contact Phone Number."
      });
    }

    const uniqueTag = `${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const refCode = referenceId || `BULK-${uniqueTag}`;

    const sanitizedRequirements = Array.isArray(requirements)
      ? requirements.map((reqItem) => ({
          category: reqItem.category || "General Bulk Procurement",
          itemName: reqItem.itemName || "Bulk Item Demand",
          quantity: Number(reqItem.quantity) || 100,
          sampleImage: reqItem.sampleImage || "",
          notes: reqItem.notes || ""
        }))
      : [];

    const totalQty = Number(totalQuantity) || sanitizedRequirements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    const bulkOrder = new SchoolBulkOrder({
      referenceId: refCode,
      institutionName,
      schoolId: schoolId || "",
      institutionType: institutionType || "K-12 School",
      contactName,
      contactEmail: contactEmail || "",
      contactPhone,
      designation: designation || "Administrator",
      address: address || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      requirements: sanitizedRequirements,
      totalQuantity: totalQty,
      targetDeliveryDate: targetDeliveryDate || "",
      logoEmbroideryRequired: Boolean(logoEmbroideryRequired),
      targetBudgetPerKit: targetBudgetPerKit || "",
      additionalNotes: additionalNotes || "",
      assignmentMode: req.body.assignmentMode || "broadcast",
      status: "published"
    });

    await bulkOrder.save();

    return res.status(201).json({
      success: true,
      message: "School Bulk Order inquiry submitted successfully and broadcast to sellers!",
      referenceId: bulkOrder.referenceId,
      bulkOrder
    });
  } catch (error) {
    console.error("School Bulk Order submission error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

import {
  getAdminSchoolOrders,
  distributeSchoolOrder,
  approveSellerQuotation
} from "../controllers/schoolBulkOrderController.js";

// GET all School Bulk Orders (Admin view)
router.get("/bulk-orders/list", getAdminSchoolOrders);
router.get("/bulk-orders/admin-list", getAdminSchoolOrders);

// PATCH Admin Distribute Bulk Order (Direct, Selected, Broadcast)
router.patch("/bulk-orders/:id/distribute", distributeSchoolOrder);

// POST Admin Approve Specific Seller Quotation
router.post("/bulk-orders/:id/approve-quote", approveSellerQuotation);

export default router;

