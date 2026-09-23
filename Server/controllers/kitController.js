import Kit from "../models/Kit.js";

// Browse all available Kit Bundles (with filters: School, Gender, Class, Tag)
export const getKits = async (req, res) => {
  try {
    const { schoolName, gender, classGrade, badgeTag, search, sellerId } = req.query;
    const filter = { status: { $nin: ["deleted"] }, isDeleted: { $ne: true } };

    if (schoolName) filter.schoolName = { $regex: schoolName, $options: "i" };
    if (gender && gender !== "All") filter.gender = gender;
    if (classGrade) filter.classGrade = { $regex: classGrade, $options: "i" };
    if (badgeTag) filter.badgeTag = badgeTag;
    if (sellerId) filter.sellerId = sellerId;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { schoolName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } }
      ];
    }

    const kits = await Kit.find(filter)
      .populate("sellerId", "storeName name city phone")
      .sort({ createdAt: -1 });

    res.json({
      count: kits.length,
      kits
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch kits", error: error.message });
  }
};

// Get single Kit Bundle details by ID
export const getKitById = async (req, res) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, isDeleted: { $ne: true }, status: { $nin: ["deleted"] } })
      .populate("sellerId", "storeName name city phone location")
      .populate("items.productId", "name price images category");

    if (!kit) {
      return res.status(404).json({ message: "Kit bundle not found or has been deleted" });
    }

    res.json(kit);
  } catch (error) {
    res.status(404).json({ message: "Kit bundle not found or has been deleted", error: error.message });
  }
};
