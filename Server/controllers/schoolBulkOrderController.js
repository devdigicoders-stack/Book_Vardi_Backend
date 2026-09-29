import mongoose from "mongoose";
import SchoolBulkOrder from "../models/SchoolBulkOrder.js";
import Seller from "../models/Seller.js";

// GET School Bulk Orders for the authenticated/requesting Customer (Strictly Private)
export const getCustomerSchoolOrders = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.headers["x-user-id"] || req.query.userId || req.query.customerId;
    const rawPhone = req.headers["x-user-phone"] || req.query.phone || req.query.userPhone || req.user?.phone || "";
    const rawEmail = req.headers["x-user-email"] || req.query.email || req.query.userEmail || req.user?.email || "";

    const cleanPhone = String(rawPhone || "").replace(/\D/g, "").slice(-10);
    const cleanEmail = String(rawEmail || "").trim().toLowerCase();

    // Build strict identity filters
    const queryConditions = [];

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      queryConditions.push({ userId });
    }

    if (cleanPhone && cleanPhone.length >= 10) {
      queryConditions.push({ contactPhone: new RegExp(cleanPhone + "$", "i") });
      queryConditions.push({ userPhone: new RegExp(cleanPhone + "$", "i") });
    }

    if (cleanEmail && !cleanEmail.includes("@bookvardi.local")) {
      queryConditions.push({ contactEmail: cleanEmail });
      queryConditions.push({ userEmail: cleanEmail });
    }

    // If caller has no identity credentials provided, they cannot view any private bulk orders
    if (queryConditions.length === 0) {
      return res.json({ success: true, count: 0, orders: [] });
    }

    const orders = await SchoolBulkOrder.find({ $or: queryConditions })
      .populate("sellerId", "storeName name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch customer bulk orders", error: error.message });
  }
};

// GET all School Bulk Orders for Admin (or delegates to Customer view if requested by customer)
export const getAdminSchoolOrders = async (req, res) => {
  try {
    const rawPhone = req.headers["x-user-phone"] || req.query.phone || "";
    const rawUserId = req.headers["x-user-id"] || req.query.userId || "";
    const authHeader = req.headers["authorization"] || "";
    const isAdmin = req.user?.role === "admin" || req.user?.role === "super_admin" || authHeader.includes("admin");

    // If caller is a customer (phone or userId provided without admin privileges), make it strictly private!
    if (!isAdmin && (rawPhone || rawUserId)) {
      return getCustomerSchoolOrders(req, res);
    }

    const orders = await SchoolBulkOrder.find()
      .populate("sellerId", "storeName name phone email businessName")
      .populate("invitedSellerIds", "storeName name phone email businessName")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch school bulk orders", error: error.message });
  }
};

// PATCH Admin Distribute Order (Option A: Direct, Option B: Selected, Option C: Broadcast, Option D: Admin Direct)
export const distributeSchoolOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignmentMode, sellerId, invitedSellerIds } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    if (!["direct", "selected", "broadcast", "admin_direct"].includes(assignmentMode)) {
      return res.status(400).json({ success: false, message: "Invalid assignment mode. Choose 'direct', 'selected', 'broadcast', or 'admin_direct'." });
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
    } else if (assignmentMode === "admin_direct") {
      bulkOrder.sellerId = null;
      bulkOrder.invitedSellerIds = [];
      bulkOrder.status = "assigned_to_admin";
      bulkOrder.fulfilledBy = "BookVardi HQ";
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
    const rawSellerId = req.user?.id || req.seller?._id || req.headers["x-seller-id"];
    const mongoose = (await import("mongoose")).default;

    const possibleIds = [
      rawSellerId,
      req.user?._id,
      req.seller?.id,
      req.headers["x-seller-id"]
    ].filter(id => id && id !== "undefined" && id !== "null" && id !== "[object Object]");

    const validObjectIds = possibleIds
      .filter(id => mongoose.Types.ObjectId.isValid(String(id)))
      .map(id => new mongoose.Types.ObjectId(id));

    const stringIds = possibleIds.map(id => String(id));

    const queryConditions = [
      { assignmentMode: "broadcast" }
    ];

    if (validObjectIds.length > 0 || stringIds.length > 0) {
      const matchIds = [...validObjectIds, ...stringIds];
      queryConditions.push(
        { sellerId: { $in: matchIds } },
        { invitedSellerIds: { $in: matchIds } },
        { "quotations.sellerId": { $in: matchIds } }
      );
    }

    const orders = await SchoolBulkOrder.find({
      $or: queryConditions
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
    const {
      quoteAmount,
      unitPrice,
      itemPrices,
      volumeDiscountNote,
      estimatedDeliveryDays,
      proposedDeliveryDate,
      notes,
      sellerAdvanceType,
      sellerAdvancePercentage,
      sellerAdvanceAmount,
      sellerAdvanceTerms,
      prepaymentType,
      prepaymentPercentage,
      prepaymentAmount,
      prepaymentTerms
    } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const seller = await Seller.findById(sellerId);
    const sellerName = seller ? (seller.ownerName || seller.name || "Vendor") : "Vendor";
    const sellerStoreName = seller ? (seller.storeName || seller.businessName || "Store") : "Store";
    const sellerPhone = seller ? (seller.phone || "") : "";
    const sellerCity = seller ? (seller.city || "") : "";

    // Process and enrich itemPrices with calculations and scale notes
    let formattedItemPrices = [];
    let calculatedSubtotal = 0;

    if (Array.isArray(itemPrices) && itemPrices.length > 0) {
      formattedItemPrices = itemPrices.map((ip, idx) => {
        const reqItem = Array.isArray(bulkOrder.requirements)
          ? bulkOrder.requirements.find(
              (r, rIdx) => String(r._id || rIdx) === String(ip.itemId) || String(r.itemName) === String(ip.itemName)
            )
          : null;

        const qty = Number(ip.quantity || reqItem?.quantity || 1);
        const unitRate = Number(ip.pricePerUnit || 0);
        const custBudget = Number(ip.customerBudget || reqItem?.budgetPerUnit || 0);
        const lineTotal = Number(ip.totalPrice) || (qty * unitRate);

        if (reqItem && unitRate > 0) {
          reqItem.sellerPricePerUnit = unitRate;
        }

        calculatedSubtotal += lineTotal;

        return {
          itemId: String(ip.itemId || reqItem?._id || idx),
          itemName: ip.itemName || reqItem?.itemName || "Bulk Item",
          category: ip.category || reqItem?.category || "General Bulk Procurement",
          quantity: qty,
          customerBudget: custBudget,
          pricePerUnit: unitRate,
          totalPrice: lineTotal,
          discountTierNote: ip.discountTierNote || ""
        };
      });
    }

    const finalQuoteAmount = calculatedSubtotal > 0 ? calculatedSubtotal : Number(quoteAmount || 0);
    if (!finalQuoteAmount || finalQuoteAmount <= 0) {
      return res.status(400).json({ success: false, message: "Quote amount or item prices are required." });
    }

    const totalQty = Array.isArray(bulkOrder.requirements)
      ? bulkOrder.requirements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
      : (bulkOrder.totalQuantity || 1);
    const calculatedUnitPrice = Number(unitPrice) || (totalQty > 0 ? Math.round(finalQuoteAmount / totalQty) : 0);

    // Check if seller already submitted a quotation
    const existingIndex = bulkOrder.quotations.findIndex(
      q => String(q.sellerId) === String(sellerId)
    );

    let finalAdvanceType = prepaymentType || sellerAdvanceType || "percentage";
    let finalAdvancePct = Number(prepaymentPercentage ?? sellerAdvancePercentage) || 0;
    let finalAdvanceAmt = Number(prepaymentAmount ?? sellerAdvanceAmount) || 0;
    let finalAdvanceTerms = prepaymentTerms || sellerAdvanceTerms || "";

    if (finalAdvanceType === "percentage" && finalAdvancePct > 0) {
      finalAdvanceAmt = Math.round((finalQuoteAmount * finalAdvancePct) / 100);
    } else if (finalAdvanceType === "amount" && finalAdvanceAmt > 0) {
      finalAdvancePct = finalQuoteAmount > 0 ? Math.round((finalAdvanceAmt / finalQuoteAmount) * 100) : 0;
    }

    const quoteObj = {
      sellerId,
      sellerName,
      sellerStoreName,
      sellerPhone,
      sellerCity,
      quoteAmount: finalQuoteAmount,
      unitPrice: calculatedUnitPrice,
      itemPrices: formattedItemPrices,
      volumeDiscountNote: volumeDiscountNote || "",
      estimatedDeliveryDays: Number(estimatedDeliveryDays) || 7,
      proposedDeliveryDate: proposedDeliveryDate || "",
      notes: notes || "",
      sellerAdvanceType: finalAdvanceType,
      sellerAdvancePercentage: finalAdvancePct,
      sellerAdvanceAmount: finalAdvanceAmt,
      sellerAdvanceTerms: finalAdvanceTerms,
      prepaymentType: finalAdvanceType,
      prepaymentPercentage: finalAdvancePct,
      prepaymentAmount: finalAdvanceAmt,
      prepaymentTerms: finalAdvanceTerms,
      status: "submitted",
      submittedAt: new Date()
    };

    if (existingIndex >= 0) {
      const prev = bulkOrder.quotations[existingIndex];
      const history = Array.isArray(prev.negotiationHistory) ? [...prev.negotiationHistory] : [];
      const currentVersion = (prev.currentVersion || 1) + 1;
      const prevDays = Number(prev.estimatedDeliveryDays || 7);
      const prevPct = Number(prev.prepaymentPercentage || 0);
      const prevAmt = Number(prev.prepaymentAmount || 0);

      const prepaymentRaised = (finalAdvancePct > prevPct) || (finalAdvanceAmt > prevAmt);
      const deliveryDaysRaised = (Number(estimatedDeliveryDays) || 7) > prevDays;

      history.push({
        round: history.length + 1,
        version: currentVersion,
        senderRole: "seller",
        senderName: sellerName,
        senderId: String(sellerId),
        quoteAmount: finalQuoteAmount,
        unitPrice: calculatedUnitPrice,
        itemPrices: formattedItemPrices,
        estimatedDeliveryDays: Number(estimatedDeliveryDays) || 7,
        proposedDeliveryDate: proposedDeliveryDate || "",
        prepaymentType: finalAdvanceType,
        prepaymentPercentage: finalAdvancePct,
        prepaymentAmount: finalAdvanceAmt,
        prepaymentRaised,
        deliveryDaysRaised,
        notes: notes || volumeDiscountNote || `Seller updated quotation (Version ${currentVersion})`,
        createdAt: new Date()
      });

      quoteObj.currentVersion = currentVersion;
      quoteObj.negotiationStage = "revised_by_seller";
      quoteObj.latestBuyerCounter = prev.latestBuyerCounter || {};
      quoteObj.negotiationHistory = history;

      bulkOrder.quotations[existingIndex] = quoteObj;
    } else {
      const initialRound = {
        round: 1,
        version: 1,
        senderRole: "seller",
        senderName: sellerName,
        senderId: String(sellerId),
        quoteAmount: finalQuoteAmount,
        unitPrice: calculatedUnitPrice,
        itemPrices: formattedItemPrices,
        estimatedDeliveryDays: Number(estimatedDeliveryDays) || 7,
        proposedDeliveryDate: proposedDeliveryDate || "",
        prepaymentType: finalAdvanceType,
        prepaymentPercentage: finalAdvancePct,
        prepaymentAmount: finalAdvanceAmt,
        prepaymentRaised: false,
        deliveryDaysRaised: false,
        notes: notes || volumeDiscountNote || "Initial seller quotation (Version 1)",
        createdAt: new Date()
      };

      quoteObj.currentVersion = 1;
      quoteObj.negotiationStage = "seller_quoted";
      quoteObj.negotiationHistory = [initialRound];

      bulkOrder.quotations.push(quoteObj);
    }

    if (finalAdvancePct > 0 || finalAdvanceAmt > 0) {
      bulkOrder.sellerAdvanceType = finalAdvanceType;
      bulkOrder.sellerAdvancePercentage = finalAdvancePct;
      bulkOrder.sellerAdvanceAmount = finalAdvanceAmt;
      bulkOrder.sellerAdvanceTerms = finalAdvanceTerms;
      bulkOrder.prepaymentPercentage = finalAdvancePct;
      bulkOrder.prepaymentAmount = finalAdvanceAmt;
      bulkOrder.prepaymentType = finalAdvanceType;
      bulkOrder.prepaymentTerms = finalAdvanceTerms;
      bulkOrder.advancePaymentStatus = "demanded";
    }

    bulkOrder.status = "quoted";
    await bulkOrder.save();

    res.json({
      success: true,
      message: `Quotation of ₹${Number(finalQuoteAmount).toLocaleString()} submitted successfully!`,
      order: bulkOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to submit quotation", error: error.message });
  }
};

// POST Buyer Submit 2nd Version / Counter-Demand on a Seller Quotation
export const submitBuyerCounterDemand = async (req, res) => {
  try {
    const { id, quoteId } = req.params;
    const {
      targetBudget,
      unitPrice,
      requestedDeliveryDays,
      proposedAdvancePercentage,
      proposedAdvanceAmount,
      itemDemands,
      notes,
      callerRole
    } = req.body;

    // Strict constraint: Admin is an observer only and cannot submit counter-demands
    if (req.user?.role === "admin" || req.user?.role === "super_admin" || req.user?.role === "subadmin" || callerRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin is an observer only and cannot submit counter-demands."
      });
    }

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const quote = bulkOrder.quotations.id(quoteId) || bulkOrder.quotations.find(q => String(q._id) === String(quoteId));
    if (!quote) {
      return res.status(404).json({ success: false, message: "Specified seller quotation not found" });
    }

    if (quote.status === "approved" || quote.status === "rejected") {
      return res.status(400).json({ success: false, message: "Cannot counter a finalised quotation." });
    }

    const newVersion = (quote.currentVersion || 1) + 1;
    quote.currentVersion = newVersion;
    quote.negotiationStage = "buyer_countered";

    const formattedItemDemands = Array.isArray(itemDemands) ? itemDemands.map(idm => ({
      itemId: String(idm.itemId || ""),
      itemName: idm.itemName || "",
      quantity: Number(idm.quantity) || 1,
      targetUnitPrice: Number(idm.targetUnitPrice) || 0,
      targetTotalPrice: Number(idm.targetTotalPrice) || (Number(idm.quantity || 1) * Number(idm.targetUnitPrice || 0)),
      notes: idm.notes || ""
    })) : [];

    quote.latestBuyerCounter = {
      targetBudget: Number(targetBudget) || 0,
      requestedDeliveryDays: Number(requestedDeliveryDays) || 0,
      proposedAdvancePercentage: Number(proposedAdvancePercentage) || 0,
      proposedAdvanceAmount: Number(proposedAdvanceAmount) || 0,
      notes: notes || "",
      itemDemands: formattedItemDemands,
      counteredAt: new Date()
    };

    if (!Array.isArray(quote.negotiationHistory)) {
      quote.negotiationHistory = [];
    }

    // Ensure round 1 exists if missing
    if (quote.negotiationHistory.length === 0) {
      quote.negotiationHistory.push({
        round: 1,
        version: 1,
        senderRole: "seller",
        senderName: quote.sellerName || "Seller",
        senderId: String(quote.sellerId || ""),
        quoteAmount: quote.quoteAmount,
        unitPrice: quote.unitPrice,
        itemPrices: quote.itemPrices,
        estimatedDeliveryDays: quote.estimatedDeliveryDays,
        prepaymentPercentage: quote.prepaymentPercentage,
        prepaymentAmount: quote.prepaymentAmount,
        notes: quote.notes || "Initial seller quotation",
        createdAt: quote.createdAt || quote.submittedAt || new Date()
      });
    }

    quote.negotiationHistory.push({
      round: quote.negotiationHistory.length + 1,
      version: newVersion,
      senderRole: "buyer",
      senderName: req.user?.name || bulkOrder.institutionName || "School / Buyer",
      senderId: String(req.user?.id || req.user?._id || ""),
      quoteAmount: Number(targetBudget) || 0,
      unitPrice: Number(unitPrice) || 0,
      itemPrices: formattedItemDemands.map(fd => ({
        itemId: fd.itemId,
        itemName: fd.itemName,
        quantity: fd.quantity,
        sellerPrice: fd.targetUnitPrice,
        totalPrice: fd.targetTotalPrice,
        discountTierNote: fd.notes
      })),
      estimatedDeliveryDays: Number(requestedDeliveryDays) || 0,
      prepaymentPercentage: Number(proposedAdvancePercentage) || 0,
      prepaymentAmount: Number(proposedAdvanceAmount) || 0,
      prepaymentRaised: false,
      deliveryDaysRaised: false,
      notes: notes || `Buyer submitted 2nd version counter-demand (Version ${newVersion})`,
      createdAt: new Date()
    });

    await bulkOrder.save();

    return res.json({
      success: true,
      message: `2nd version counter-demand (v${newVersion}) sent to ${quote.sellerStoreName || quote.sellerName || "seller"} successfully!`,
      order: bulkOrder,
      quotation: quote
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to submit counter demand", error: error.message });
  }
};

// POST Seller Accept Buyer Counter Demand Directly
export const acceptBuyerCounterDemand = async (req, res) => {
  try {
    const { id, quoteId } = req.params;
    const sellerId = String(req.user?.id || req.seller?._id || req.user?._id || "");
    const { notes } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const quote = bulkOrder.quotations.id(quoteId) || bulkOrder.quotations.find(q => String(q._id) === String(quoteId));
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    if (String(quote.sellerId) !== sellerId && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied. Only the quoting seller can accept buyer counter-demand." });
    }

    const counter = quote.latestBuyerCounter;
    if (!counter || (!counter.targetBudget && !counter.notes)) {
      return res.status(400).json({ success: false, message: "No active buyer counter-demand found on this quotation." });
    }

    // Adopt buyer's counter values
    if (counter.targetBudget > 0) {
      quote.quoteAmount = counter.targetBudget;
      const totalQty = Array.isArray(bulkOrder.requirements)
        ? bulkOrder.requirements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
        : (bulkOrder.totalQuantity || 1);
      quote.unitPrice = totalQty > 0 ? Math.round(counter.targetBudget / totalQty) : 0;
    }

    if (counter.requestedDeliveryDays > 0) {
      quote.estimatedDeliveryDays = counter.requestedDeliveryDays;
    }

    if (counter.proposedAdvancePercentage > 0) {
      quote.prepaymentPercentage = counter.proposedAdvancePercentage;
      quote.prepaymentAmount = Math.round((quote.quoteAmount * counter.proposedAdvancePercentage) / 100);
    } else if (counter.proposedAdvanceAmount > 0) {
      quote.prepaymentAmount = counter.proposedAdvanceAmount;
      quote.prepaymentPercentage = quote.quoteAmount > 0 ? Math.round((counter.proposedAdvanceAmount / quote.quoteAmount) * 100) : 0;
    }

    quote.negotiationStage = "seller_accepted_counter";

    if (!Array.isArray(quote.negotiationHistory)) {
      quote.negotiationHistory = [];
    }

    quote.negotiationHistory.push({
      round: quote.negotiationHistory.length + 1,
      version: quote.currentVersion || 1,
      senderRole: "seller",
      senderName: quote.sellerName || "Seller",
      senderId: String(quote.sellerId),
      quoteAmount: quote.quoteAmount,
      unitPrice: quote.unitPrice,
      estimatedDeliveryDays: quote.estimatedDeliveryDays,
      prepaymentPercentage: quote.prepaymentPercentage,
      prepaymentAmount: quote.prepaymentAmount,
      prepaymentRaised: false,
      deliveryDaysRaised: false,
      notes: notes || "Seller accepted buyer's counter-demand terms. Ready for buyer confirmation.",
      createdAt: new Date()
    });

    await bulkOrder.save();

    return res.json({
      success: true,
      message: "Buyer's counter-demand accepted successfully! Quotation updated to buyer terms.",
      order: bulkOrder,
      quotation: quote
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to accept counter demand", error: error.message });
  }
};

// POST Seller Revise Quotation (Raise Prepayment, Adjust Lead Days & Pricing)
export const reviseSellerQuotation = async (req, res) => {
  try {
    const { id, quoteId } = req.params;
    const sellerId = String(req.user?.id || req.seller?._id || req.user?._id || "");
    const {
      quoteAmount,
      unitPrice,
      itemPrices,
      volumeDiscountNote,
      estimatedDeliveryDays,
      proposedDeliveryDate,
      prepaymentType,
      prepaymentPercentage,
      prepaymentAmount,
      prepaymentTerms,
      notes
    } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const quote = bulkOrder.quotations.id(quoteId) || bulkOrder.quotations.find(q => String(q._id) === String(quoteId));
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }

    if (String(quote.sellerId) !== sellerId && req.user?.role !== "super_admin") {
      return res.status(403).json({ success: false, message: "Access denied. Only the quoting seller can revise this quotation." });
    }

    const prevDays = Number(quote.estimatedDeliveryDays || 7);
    const prevPct = Number(quote.prepaymentPercentage || 0);
    const prevAmt = Number(quote.prepaymentAmount || 0);

    const newDays = Number(estimatedDeliveryDays) || prevDays;
    const newAdvType = prepaymentType || quote.prepaymentType || "percentage";
    let newAdvPct = Number(prepaymentPercentage ?? prevPct) || 0;
    let newAdvAmt = Number(prepaymentAmount ?? prevAmt) || 0;

    let finalQuoteAmount = Number(quoteAmount) || quote.quoteAmount;

    // Process itemPrices if provided
    if (Array.isArray(itemPrices) && itemPrices.length > 0) {
      let lineTotalSum = 0;
      quote.itemPrices = itemPrices.map(ip => {
        const lineTotal = Number(ip.totalPrice) || (Number(ip.quantity || 1) * Number(ip.pricePerUnit || 0));
        lineTotalSum += lineTotal;
        return {
          itemId: String(ip.itemId || ""),
          itemName: ip.itemName || "Bulk Item",
          category: ip.category || "General Bulk Procurement",
          quantity: Number(ip.quantity) || 1,
          customerBudget: Number(ip.customerBudget) || 0,
          pricePerUnit: Number(ip.pricePerUnit) || 0,
          totalPrice: lineTotal,
          discountTierNote: ip.discountTierNote || ""
        };
      });
      if (lineTotalSum > 0) finalQuoteAmount = lineTotalSum;
    }

    if (newAdvType === "percentage" && newAdvPct > 0) {
      newAdvAmt = Math.round((finalQuoteAmount * newAdvPct) / 100);
    } else if (newAdvType === "amount" && newAdvAmt > 0) {
      newAdvPct = finalQuoteAmount > 0 ? Math.round((newAdvAmt / finalQuoteAmount) * 100) : 0;
    }

    const prepaymentRaised = (newAdvPct > prevPct) || (newAdvAmt > prevAmt);
    const deliveryDaysRaised = newDays > prevDays;

    const newVersion = (quote.currentVersion || 1) + 1;
    quote.currentVersion = newVersion;
    quote.quoteAmount = finalQuoteAmount;
    quote.estimatedDeliveryDays = newDays;
    if (proposedDeliveryDate) quote.proposedDeliveryDate = proposedDeliveryDate;
    quote.prepaymentType = newAdvType;
    quote.prepaymentPercentage = newAdvPct;
    quote.prepaymentAmount = newAdvAmt;
    quote.prepaymentTerms = prepaymentTerms || quote.prepaymentTerms || "";
    quote.notes = notes || volumeDiscountNote || quote.notes || "";
    quote.volumeDiscountNote = volumeDiscountNote || quote.volumeDiscountNote || "";
    quote.negotiationStage = "revised_by_seller";

    const totalQty = Array.isArray(bulkOrder.requirements)
      ? bulkOrder.requirements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
      : (bulkOrder.totalQuantity || 1);
    quote.unitPrice = Number(unitPrice) || (totalQty > 0 ? Math.round(finalQuoteAmount / totalQty) : 0);

    if (!Array.isArray(quote.negotiationHistory)) {
      quote.negotiationHistory = [];
    }

    quote.negotiationHistory.push({
      round: quote.negotiationHistory.length + 1,
      version: newVersion,
      senderRole: "seller",
      senderName: quote.sellerName || "Seller",
      senderId: String(quote.sellerId),
      quoteAmount: finalQuoteAmount,
      unitPrice: quote.unitPrice,
      itemPrices: quote.itemPrices,
      estimatedDeliveryDays: newDays,
      proposedDeliveryDate: quote.proposedDeliveryDate,
      prepaymentType: newAdvType,
      prepaymentPercentage: newAdvPct,
      prepaymentAmount: newAdvAmt,
      prepaymentRaised,
      deliveryDaysRaised,
      notes: notes || volumeDiscountNote || `Seller revised quotation (Version ${newVersion})`,
      createdAt: new Date()
    });

    await bulkOrder.save();

    return res.json({
      success: true,
      message: `Revised quotation (Version ${newVersion}) submitted successfully! Prepayment: ${newAdvPct}%, Lead Days: ${newDays}`,
      order: bulkOrder,
      quotation: quote
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to revise quotation", error: error.message });
  }
};

// POST Admin / Customer Approve Specific Seller Quotation
export const approveSellerQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { quoteId, updatedRequirements, totalQuantity, quoteAmount, callerRole } = req.body || {};
    const effectiveQuoteId = quoteId || req.params.quoteId;

    // Admin is an observer and distributor only; quotations can only be accepted by the buyer
    if (req.user?.role === "admin" || req.user?.role === "super_admin" || req.user?.role === "subadmin" || callerRole === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin cannot approve or reject bulk orders. Quotations can only be accepted by the buyer."
      });
    }

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const winningQuote = bulkOrder.quotations.id(effectiveQuoteId) || bulkOrder.quotations.find(q => String(q._id) === String(effectiveQuoteId));
    if (!winningQuote) {
      return res.status(404).json({ success: false, message: "Specified quotation not found." });
    }

    // Mark all quotes status & negotiation stages
    bulkOrder.quotations.forEach(q => {
      if (String(q._id) === String(effectiveQuoteId)) {
        q.status = "approved";
        q.negotiationStage = "approved";
      } else {
        q.status = "rejected";
        q.negotiationStage = "rejected";
      }
    });

    if (!Array.isArray(winningQuote.negotiationHistory)) {
      winningQuote.negotiationHistory = [];
    }
    winningQuote.negotiationHistory.push({
      round: winningQuote.negotiationHistory.length + 1,
      version: winningQuote.currentVersion || 1,
      senderRole: "buyer",
      senderName: req.user?.name || bulkOrder.institutionName || "Buyer",
      senderId: String(req.user?.id || req.user?._id || ""),
      quoteAmount: winningQuote.quoteAmount,
      unitPrice: winningQuote.unitPrice,
      estimatedDeliveryDays: winningQuote.estimatedDeliveryDays,
      prepaymentPercentage: winningQuote.prepaymentPercentage,
      prepaymentAmount: winningQuote.prepaymentAmount,
      prepaymentRaised: false,
      deliveryDaysRaised: false,
      notes: "Quotation officially accepted and approved by the buyer as the WINNING quote.",
      createdAt: new Date()
    });

    bulkOrder.acceptedQuoteId = winningQuote._id;
    if (winningQuote.sellerId) {
      bulkOrder.sellerId = winningQuote.sellerId;
    }
    // Set status to accepted / quote_accepted
    bulkOrder.status = "accepted";
    bulkOrder.deliveryMode = "self_delivery";

    // Handle Buyer updating order size / item counts upon quote acceptance
    if (Array.isArray(updatedRequirements) && updatedRequirements.length > 0 && Array.isArray(bulkOrder.requirements)) {
      updatedRequirements.forEach((uReq) => {
        const reqItem = bulkOrder.requirements.find(
          (r, idx) => String(r._id || idx) === String(uReq._id || uReq.itemId || idx) || String(r.itemName) === String(uReq.itemName)
        );
        if (reqItem) {
          if (uReq.quantity !== undefined && Number(uReq.quantity) > 0) {
            reqItem.quantity = Number(uReq.quantity);
          }
          if (uReq.sellerPricePerUnit !== undefined && Number(uReq.sellerPricePerUnit) > 0) {
            reqItem.sellerPricePerUnit = Number(uReq.sellerPricePerUnit);
          }
        }
      });

      // Also update winningQuote itemPrices if present
      if (Array.isArray(winningQuote.itemPrices)) {
        winningQuote.itemPrices.forEach((ip) => {
          const uReq = updatedRequirements.find(
            (u, idx) => String(u._id || u.itemId || idx) === String(ip.itemId) || String(u.itemName) === String(ip.itemName)
          );
          if (uReq && uReq.quantity !== undefined) {
            ip.quantity = Number(uReq.quantity);
            ip.totalPrice = Number(ip.quantity) * Number(ip.pricePerUnit || 0);
          }
        });
      }
    }

    // Sync winning quote itemPrices to main requirements sellerPricePerUnit
    if (Array.isArray(winningQuote.itemPrices) && winningQuote.itemPrices.length > 0 && Array.isArray(bulkOrder.requirements)) {
      winningQuote.itemPrices.forEach((ip) => {
        const reqItem = bulkOrder.requirements.find((r, idx) => String(r._id || idx) === String(ip.itemId) || String(r.itemName) === String(ip.itemName));
        if (reqItem) {
          reqItem.sellerPricePerUnit = Number(ip.pricePerUnit) || 0;
        }
      });
    }

    const calculatedTotalQty = Number(totalQuantity) || (
      Array.isArray(bulkOrder.requirements)
        ? bulkOrder.requirements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
        : bulkOrder.totalQuantity
    );
    bulkOrder.totalQuantity = calculatedTotalQty;

    const finalAmount = Number(quoteAmount) || Number(winningQuote.quoteAmount);
    winningQuote.quoteAmount = finalAmount;
    bulkOrder.targetBudgetPerKit = String(finalAmount);
    bulkOrder.overallBudget = finalAmount;

    const advPct = Number(req.body.prepaymentPercentage ?? req.body.sellerAdvancePercentage ?? winningQuote.prepaymentPercentage ?? winningQuote.sellerAdvancePercentage ?? 0);
    const advAmt = Number(req.body.prepaymentAmount ?? req.body.sellerAdvanceAmount ?? winningQuote.prepaymentAmount ?? winningQuote.sellerAdvanceAmount ?? 0) || (advPct > 0 ? Math.round((finalAmount * advPct) / 100) : 0);
    const advType = winningQuote.prepaymentType || winningQuote.sellerAdvanceType || "percentage";
    const advTerms = winningQuote.prepaymentTerms || winningQuote.sellerAdvanceTerms || "";

    if (advPct > 0 || advAmt > 0) {
      winningQuote.prepaymentPercentage = advPct;
      winningQuote.prepaymentAmount = advAmt;
      winningQuote.sellerAdvancePercentage = advPct;
      winningQuote.sellerAdvanceAmount = advAmt;

      bulkOrder.sellerAdvanceType = advType;
      bulkOrder.sellerAdvancePercentage = advPct;
      bulkOrder.sellerAdvanceAmount = advAmt;
      bulkOrder.sellerAdvanceTerms = advTerms;
      bulkOrder.prepaymentPercentage = advPct;
      bulkOrder.prepaymentAmount = advAmt;
      bulkOrder.prepaymentType = advType;
      bulkOrder.prepaymentTerms = advTerms;
      bulkOrder.advancePaymentStatus = "agreed";
    }

    await bulkOrder.save();

    res.json({
      success: true,
      message: `Approved quotation from ${winningQuote.sellerStoreName || winningQuote.sellerName}! Order accepted and assigned to vendor.`,
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
      referenceId,
      institutionName,
      contactName,
      contactPhone,
      contactEmail,
      requirements,
      requirementSummary,
      quantity,
      estimatedBudget,
      overallBudget,
      quoteAmount,
      targetDeliveryDate,
      logoEmbroideryRequired,
      additionalNotes
    } = req.body;

    if (!institutionName || !contactName || !contactPhone) {
      return res.status(400).json({ message: "Institution name, contact person, and phone are required." });
    }

    const refId = referenceId || `SCH-REQ-${Math.floor(1000 + Math.random() * 9000)}`;

    const formattedRequirements = Array.isArray(requirements) ? requirements.map(r => ({
      category: r.category || "General Bulk Procurement",
      itemName: r.itemName || r.name || "Bulk Item",
      quantity: Number(r.quantity) || 100,
      budgetPerUnit: Number(r.budgetPerUnit || r.budgetUnit) || 0,
      sellerPricePerUnit: Number(r.sellerPricePerUnit || r.sellerPrice) || 0,
      sampleImage: r.sampleImage || (Array.isArray(r.sampleImages) ? r.sampleImages[0] : ""),
      sampleImages: Array.isArray(r.sampleImages) ? r.sampleImages : (r.sampleImage ? [r.sampleImage] : []),
      customizations: r.customizations || "",
      notes: r.notes || r.additionalNotes || ""
    })) : [];

    const calculatedOverallBudget = Number(overallBudget) || formattedRequirements.reduce((sum, item) => sum + (item.quantity * item.budgetPerUnit), 0) || Number(estimatedBudget) || 0;
    const calculatedTotalQty = Number(quantity) || formattedRequirements.reduce((sum, item) => sum + item.quantity, 0) || 100;

    const newReq = new SchoolBulkOrder({
      referenceId: refId,
      institutionName,
      contactName,
      contactPhone,
      contactEmail: contactEmail || "school@institute.edu.in",
      city: req.body.city || "Delhi",
      state: req.body.state || "Delhi",
      pincode: req.body.pincode || "110001",
      requirements: formattedRequirements,
      totalQuantity: calculatedTotalQty,
      overallBudget: calculatedOverallBudget,
      targetBudgetPerKit: String(calculatedOverallBudget || estimatedBudget || 1000),
      additionalNotes: requirementSummary || additionalNotes || "",
      targetDeliveryDate: targetDeliveryDate || "",
      expectedQuotationDate: req.body.expectedQuotationDate || req.body.quotationDeadline || "",
      logoEmbroideryRequired: Boolean(logoEmbroideryRequired),
      sellerId: sellerId,
      status: sellerId ? "Requirement Received" : "pending"
    });

    await newReq.save();
    res.status(201).json({ success: true, message: "School bulk order created successfully", order: newReq });
  } catch (error) {
    res.status(500).json({ message: "Failed to create school bulk order", error: error.message });
  }
};

// PATCH Update Item-Level Seller Offered Prices
export const updateItemSellerPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemPrices } = req.body; // [{ itemId: string, sellerPricePerUnit: number }]

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ message: "School bulk requirement request not found" });
    }

    if (Array.isArray(itemPrices) && Array.isArray(bulkOrder.requirements)) {
      itemPrices.forEach((ip) => {
        const reqItem = bulkOrder.requirements.find((r, idx) => String(r._id || idx) === String(ip.itemId) || String(r.itemName) === String(ip.itemName));
        if (reqItem) {
          reqItem.sellerPricePerUnit = Number(ip.sellerPricePerUnit) || 0;
        }
      });
    }

    await bulkOrder.save();
    res.json({ success: true, message: "Item seller prices updated successfully", order: bulkOrder });
  } catch (error) {
    res.status(500).json({ message: "Failed to update item seller prices", error: error.message });
  }
};

// PATCH Update Quote Amount, Status & Self Delivery for School Bulk Requirement
export const updateSellerSchoolOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      quoteAmount,
      quantity,
      targetDeliveryDate,
      additionalNotes,
      deliveryMode,
      deliveryDetails
    } = req.body;

    const bulkOrder = await SchoolBulkOrder.findById(id);
    if (!bulkOrder) {
      return res.status(404).json({ message: "School bulk requirement request not found" });
    }

    const currentUserId = String(req.user?.id || req.seller?._id || req.user?._id || "");
    const orderSellerId = String(bulkOrder.sellerId?._id || bulkOrder.sellerId || "");

    if (orderSellerId && currentUserId && orderSellerId !== currentUserId && req.user?.role !== "admin") {
      const hasQuote = Array.isArray(bulkOrder.quotations) && bulkOrder.quotations.some(
        q => String(q.sellerId) === currentUserId
      );
      if (!hasQuote) {
        return res.status(403).json({ message: "Access denied. You can only update your own school bulk orders." });
      }
    }

    // Status progression: packed, out for delivery, received
    // Acceptance MUST happen through buyer quotation acceptance (approveSellerQuotation)
    if (status) {
      if (status === "accepted" || status === "quote_accepted") {
        return res.status(400).json({
          success: false,
          message: "Bulk order acceptance can only be confirmed by the buyer selecting a winning quotation. Admin and sellers cannot manually approve bulk orders."
        });
      }
      bulkOrder.status = status;
    }

    // Constraint: Only self delivery available for seller bulk orders
    bulkOrder.deliveryMode = "self_delivery";

    if (deliveryDetails) {
      const existingDetails = bulkOrder.deliveryDetails || {};
      const isOutForDelivery = status === "out for delivery" || status === "out_for_delivery";
      const isReceived = status === "received" || status === "delivered";

      bulkOrder.deliveryDetails = {
        deliveryBoyName: deliveryDetails.deliveryBoyName || existingDetails.deliveryBoyName || "",
        deliveryBoyPhone: deliveryDetails.deliveryBoyPhone || existingDetails.deliveryBoyPhone || "",
        vehicleNumber: deliveryDetails.vehicleNumber || existingDetails.vehicleNumber || "",
        trackingId: deliveryDetails.trackingId || existingDetails.trackingId || `BV-SLF-${bulkOrder.referenceId}`,
        trackingUrl: deliveryDetails.trackingUrl || existingDetails.trackingUrl || `/#delivery-partner?token=BV-SLF-${bulkOrder.referenceId}`,
        deliveryPartnerToken: deliveryDetails.deliveryPartnerToken || existingDetails.deliveryPartnerToken || `BV-SLF-${bulkOrder.referenceId}`,
        dispatchedAt: isOutForDelivery ? (existingDetails.dispatchedAt || new Date()) : existingDetails.dispatchedAt,
        deliveredAt: isReceived ? new Date() : existingDetails.deliveredAt,
        notes: deliveryDetails.notes || existingDetails.notes || ""
      };
    }

    if (quantity) bulkOrder.totalQuantity = Number(quantity);
    if (targetDeliveryDate) bulkOrder.targetDeliveryDate = targetDeliveryDate;
    if (additionalNotes) bulkOrder.additionalNotes = additionalNotes;
    if (quoteAmount) bulkOrder.targetBudgetPerKit = String(quoteAmount);

    await bulkOrder.save();
    res.json({
      success: true,
      message: `School bulk order status updated to '${bulkOrder.status}' with self-delivery`,
      order: bulkOrder
    });
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

// GET Download PDF Partial Advance Payment Receipt
export const downloadAdvanceReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = (await import("mongoose")).default;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { _id: id } : { referenceId: id };

    const bulkOrder = await SchoolBulkOrder.findOne(query).populate("sellerId", "storeName name phone email businessName city");
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const { generatePartialAdvanceReceiptPDF } = await import("../services/receiptService.js");
    const filename = `Partial_Advance_Receipt_${bulkOrder.referenceId}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdfDoc = generatePartialAdvanceReceiptPDF(bulkOrder);
    pdfDoc.pipe(res);
  } catch (error) {
    console.error("Download advance receipt error:", error);
    res.status(500).json({ success: false, message: "Failed to generate advance receipt", error: error.message });
  }
};

// PATCH Record or Confirm Partial Advance Payment
export const recordAdvancePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { advancePaidAmount, advancePaymentMode, advanceTransactionId, advanceReceiptNumber } = req.body;

    const mongoose = (await import("mongoose")).default;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { _id: id } : { referenceId: id };

    const bulkOrder = await SchoolBulkOrder.findOne(query);
    if (!bulkOrder) {
      return res.status(404).json({ success: false, message: "School bulk order not found" });
    }

    const paidAmt = Number(advancePaidAmount) || bulkOrder.sellerAdvanceAmount || bulkOrder.buyerAdvanceAmount || 0;
    bulkOrder.advancePaidAmount = paidAmt;
    bulkOrder.advancePaymentMode = advancePaymentMode || "Online / Bank Transfer";
    bulkOrder.advanceTransactionId = advanceTransactionId || `TXN-ADV-${Date.now().toString().slice(-6)}`;
    bulkOrder.advanceReceiptNumber = advanceReceiptNumber || `REC-ADV-${bulkOrder.referenceId}`;
    bulkOrder.advancePaidAt = new Date();
    bulkOrder.advancePaymentStatus = "paid_partially";

    await bulkOrder.save();

    res.json({
      success: true,
      message: `Partial advance payment of ₹${paidAmt.toLocaleString()} recorded successfully!`,
      order: bulkOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to record advance payment", error: error.message });
  }
};
