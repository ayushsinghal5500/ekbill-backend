// controllers/orderController.js
import { processOrder } from "../service/orderService.js";

export const createOrder = async (req, res) => {
  try {
    const result = await processOrder(req.body);

    console.log("✅ Order API Success:", {
      order_unique_code: result.order_unique_code,
      store_slug: req.body.store_slug
    });

    return res.status(200).json(result);

  } catch (error) {
    console.error("❌ Order Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while receiving order",
    });
  }
};
