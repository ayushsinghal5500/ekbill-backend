export const createOrder = async (req, res) => {
  try {
    const { store_slug, customer, items, totals } = req.body;

    console.log("🆕 NEW ORDER REQUEST ------------------");
    console.log("Store Slug:", store_slug);
    console.log("Customer:", customer);
    console.log("Items:", items);
    console.log("Totals:", totals);
    console.log("Full Payload:", req.body);
    console.log("---------------------------------------");

    return res.status(200).json({
      success: true,
      message: "Order received (console log only)",
    });

  } catch (error) {
    console.error("❌ Order Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while receiving order",
    });
  }
};
