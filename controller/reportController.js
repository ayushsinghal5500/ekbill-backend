import { overviewReportsService, salesReportsService, dailyReportsService, customerReportsService } from "../service/reportService.js";

export const overviewReportsController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    if (!business_unique_code) return res.status(401).json({ success: false, message: "Unauthorized" });

    const filter = req.query.filter || "overall";
    const data = await overviewReportsService.getOverview(business_unique_code, filter);

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const salesReportsController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const filter = req.query.filter || "overall";
    const data = await salesReportsService.getSales({ business_unique_code, filter });

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const dailyReportsController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const data = await dailyReportsService.getDaily({ business_unique_code });

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const customerReportsController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const data = await customerReportsService.getCustomerReport({ business_unique_code });

    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
