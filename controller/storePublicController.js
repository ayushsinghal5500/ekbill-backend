// controller/storePublicController.js
import { getPublicCatalogService } from "../service/storePublicService.js";

export const getPublicCatalog = async (req, res) => {
  try {
    const { slug } = req.params;
    const { category = "ALL", search = "", page = 1, limit = 12 } = req.query;

    const data = await getPublicCatalogService(
      slug,
      Number(page),
      Number(limit),
      category,
      search
    );

    if (!data) return res.status(404).json({ success: false, message: "Store not found" });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
