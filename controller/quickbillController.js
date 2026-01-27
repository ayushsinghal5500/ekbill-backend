import { createQuickBillService ,getQuickBillsListService,getQuickBillDetailsService} from "../service/quickbillService.js";

export const createQuickBill = async (req, res) => {
  try {
    const { user_unique_code, business_unique_code } = req.user;

    if (!business_unique_code)
      return res.status(400).json({ success: false, message: "Business not linked to user" });

    const data = {
      ...req.body,
      business_unique_code,
      created_by: user_unique_code
    };

    const result = await createQuickBillService(data);

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("createQuickBill error:", err);
    return res.status(500).json({ success: false, 
        message: err.message || "Internal server error" });
  }
};

export const getQuickBillsList = async (req, res) => {
  try {
    const { business_unique_code } = req.user;

    if (!business_unique_code)
      return res.status(400).json({ success: false, message: "Business not linked to user" });

    const bills = await getQuickBillsListService(business_unique_code);

    return res.status(200).json({ success: true, data: bills });
  } catch (err) {
    console.error("getQuickBillsList error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getQuickBillDetails = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const { quick_bill_unique_code } = req.params;

    const result = await getQuickBillDetailsService(quick_bill_unique_code, business_unique_code);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("getQuickBillDetails error:", err);
    return res.status(404).json({ success: false, message: err.message });
  }
};