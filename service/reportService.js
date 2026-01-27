import { OverviewReportsModel, SalesReportsModel, DailyReportsModel, CustomerReportsModel } from "../models/reportModel.js";

export const overviewReportsService = {
  getOverview: async (business_unique_code, filter) => {
    if (!business_unique_code) throw new Error("business_unique_code missing");
    return OverviewReportsModel.getOverview({ business_unique_code, filter });
  }
};

export const salesReportsService = {
  getSales: async ({ business_unique_code, filter }) => {
    if (!business_unique_code) throw new Error("business_unique_code missing");
    return SalesReportsModel.getSales({ business_unique_code, filter });
  }
};

export const dailyReportsService = {
  getDaily: async ({ business_unique_code }) => {
    if (!business_unique_code) throw new Error("business_unique_code missing");
    return DailyReportsModel.getDaily({ business_unique_code });
  }
};

export const customerReportsService = {
  getCustomerReport: async ({ business_unique_code }) => {
    if (!business_unique_code) throw new Error("business_unique_code missing");
    return CustomerReportsModel.getCustomerReport({ business_unique_code });
  }
};
