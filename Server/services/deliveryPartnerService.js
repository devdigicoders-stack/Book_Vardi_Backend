import DeliveryPartnerConfig from "../models/DeliveryPartnerConfig.js";

// Helper to get or initialize logistics configuration
export const getOrInitDeliveryConfig = async () => {
  let config = await DeliveryPartnerConfig.findOne();
  if (!config) {
    config = new DeliveryPartnerConfig({
      platformDefaultPartner: "shiprocket",
      freeShippingThreshold: 999,
      baseCodFee: 40,
      partners: [
        {
          partnerId: "shiprocket",
          name: "Shiprocket Multi-Courier Aggregator",
          code: "SHIPROCKET",
          active: true,
          isDefault: true,
          avgDays: "2-3 Days",
          baseRate: 45,
          perKgRate: 20,
          sandboxMode: true
        },
        {
          partnerId: "delhivery",
          name: "Delhivery Direct Express",
          code: "DELHIVERY",
          active: true,
          isDefault: false,
          avgDays: "1-3 Days",
          baseRate: 50,
          perKgRate: 25,
          sandboxMode: true
        },
        {
          partnerId: "bluedart",
          name: "BlueDart Campus Air Priority",
          code: "BLUEDART",
          active: true,
          isDefault: false,
          avgDays: "1-2 Days",
          baseRate: 75,
          perKgRate: 35,
          sandboxMode: true
        },
        {
          partnerId: "local_express",
          name: "BookVardi Local Hyperlocal Express",
          code: "LOCAL_EXPRESS",
          active: true,
          isDefault: false,
          avgDays: "Same Day / 24 hrs",
          baseRate: 30,
          perKgRate: 15,
          sandboxMode: true
        }
      ]
    });
    await config.save();
  }
  return config;
};

// 1. Serviceability & Courier Rate Calculation API
export const checkServiceabilityService = async ({ pickupPincode = "226001", deliveryPincode, weightKg = 1, isCod = false }) => {
  const config = await getOrInitDeliveryConfig();
  const dest = String(deliveryPincode || "110001").trim();
  const weight = Math.max(0.5, Number(weightKg) || 1);

  // Region tier logic for rate estimation
  const isMetro = dest.startsWith("11") || dest.startsWith("40") || dest.startsWith("56") || dest.startsWith("70") || dest.startsWith("60") || dest.startsWith("50");
  const isLocalState = dest.startsWith("22") || dest.startsWith("20") || dest.startsWith("26");

  const results = config.partners.map((partner) => {
    let multiplier = isLocalState ? 1.0 : isMetro ? 1.25 : 1.5;
    if (partner.code === "BLUEDART") multiplier *= 1.3;
    if (partner.code === "LOCAL_EXPRESS") multiplier = isLocalState ? 0.8 : 2.0;

    const baseCost = partner.baseRate * multiplier;
    const additionalWeightCost = Math.max(0, weight - 1) * partner.perKgRate;
    const codCharge = isCod ? config.baseCodFee : 0;
    const calculatedRate = Math.round(baseCost + additionalWeightCost + codCharge);

    const slaDays = partner.code === "LOCAL_EXPRESS"
      ? (isLocalState ? "Same Day (Within 24 hrs)" : "2-3 Days")
      : partner.code === "BLUEDART"
      ? (isMetro ? "1-2 Business Days" : "2 Days")
      : partner.code === "DELHIVERY"
      ? "2-3 Business Days"
      : "2-4 Business Days";

    return {
      partnerId: partner.partnerId,
      name: partner.name,
      code: partner.code,
      active: partner.active,
      isDefault: partner.isDefault,
      serviceable: partner.active,
      estimatedRate: calculatedRate,
      estimatedDays: slaDays,
      codAvailable: true,
      pickupPincode,
      deliveryPincode: dest
    };
  });

  return {
    success: true,
    pickupPincode,
    deliveryPincode: dest,
    weightKg: weight,
    recommendedPartner: results.find((r) => r.isDefault) || results[0],
    availablePartners: results.filter((r) => r.active)
  };
};

// 2. Automated AWB Generation & Shipment Dispatch Service
export const generateShipmentAwbService = async (orderData, courierCode = "SHIPROCKET", weightKg = 1, dimensions = {}) => {
  const config = await getOrInitDeliveryConfig();
  const selectedPartner = config.partners.find((p) => p.code === courierCode || p.partnerId === courierCode) || config.partners[0];

  const orderId = orderData.orderId || orderData.id || `SC-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanCode = selectedPartner.code;
  const uniqueAwb = `${cleanCode.slice(0, 3)}-${Date.now().toString().slice(-6)}${Math.floor(10 + Math.random() * 90)}`;
  const pickupToken = `PKP-${Math.floor(100000 + Math.random() * 900000)}`;
  const shippingLabelUrl = `/invoices/shipping-label-${uniqueAwb}.pdf`;

  const weight = Number(weightKg) || 1;

  const shipmentData = {
    awbNumber: uniqueAwb,
    courierPartnerId: selectedPartner.partnerId,
    courierPartnerName: selectedPartner.name,
    courierPartnerCode: selectedPartner.code,
    shippingLabelUrl,
    manifestUrl: `/invoices/manifest-${uniqueAwb}.pdf`,
    pickupToken,
    status: "booked",
    weightKg: weight,
    dimensions: {
      length: Number(dimensions.length) || 20,
      width: Number(dimensions.width) || 15,
      height: Number(dimensions.height) || 10
    },
    pickupScheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    courierLogs: [
      {
        title: "Shipment Created & AWB Generated",
        description: `AWB ${uniqueAwb} assigned via ${selectedPartner.name}`,
        location: "Seller Warehouse",
        timestamp: new Date().toISOString(),
        updatedBy: "System Logistics"
      },
      {
        title: "Courier Pickup Manifest Scheduled",
        description: `Pickup Token ${pickupToken} generated for courier agent dispatch`,
        location: "Seller Warehouse",
        timestamp: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        updatedBy: selectedPartner.name
      }
    ]
  };

  return {
    success: true,
    message: `Shipment booked successfully! AWB ${uniqueAwb} assigned via ${selectedPartner.name}`,
    orderId,
    shipment: shipmentData
  };
};

// 3. Live AWB Tracking Checkpoints Engine
export const getLiveAwbTrackingService = async (awbNumber) => {
  if (!awbNumber) {
    return { success: false, message: "AWB number is required for tracking." };
  }

  const cleanAwb = String(awbNumber).trim().toUpperCase();
  const courierPrefix = cleanAwb.split("-")[0] || "SHIP";

  const partnerNameMap = {
    SHIP: "Shiprocket Aggregator",
    DELH: "Delhivery Direct Express",
    BLUE: "BlueDart Campus Air",
    LOCA: "BookVardi Local Express"
  };

  const partnerName = partnerNameMap[courierPrefix] || "Shiprocket Delivery Network";

  // Simulate realistic checkpoint progress based on timestamp or AWB
  const checkpoints = [
    {
      status: "placed",
      title: "Order Placed & Confirmed",
      description: "Customer order confirmed by marketplace",
      location: "BookVardi Hub",
      timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
    },
    {
      status: "packed",
      title: "Items Packed & Manifested",
      description: "Packed into protective security satchel",
      location: "Seller Fulfillment Warehouse",
      timestamp: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString()
    },
    {
      status: "awb_generated",
      title: `AWB ${cleanAwb} Assigned`,
      description: `Dispatched to ${partnerName}`,
      location: "Origin Logistics Hub",
      timestamp: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
    },
    {
      status: "in_transit",
      title: "In Transit at Sorting Facility",
      description: "Package sorted & routed to destination regional gateway",
      location: "Central Transshipment Hub, Delhi NCR",
      timestamp: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    },
    {
      status: "out_for_delivery",
      title: "Out for Delivery",
      description: "Courier executive on the way to school/delivery address",
      location: "Destination Delivery Hub",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    }
  ];

  return {
    success: true,
    awbNumber: cleanAwb,
    courierPartnerName: partnerName,
    currentStatus: "out_for_delivery",
    estimatedDeliveryDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    trackingUrl: `https://track.shiprocket.in/tracking/${cleanAwb}`,
    checkpoints
  };
};
