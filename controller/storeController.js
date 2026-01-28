// controller/storeController.js
import { getPublicStoreLinkService } from "../service/storeService.js";

export const getPublicStoreLink = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const data = await getPublicStoreLinkService(business_unique_code);

    if (!data) {
      return res.status(404).json({ success: false, message: "Store not found" });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
