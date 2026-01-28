import {getDashboardSnapshot,getLatestDashboardNotifications,getAllNotifications} from "../models/dashboardModel.js";

export const getDashboardService = async (business_unique_code) => {
  const snapshot = await getDashboardSnapshot(business_unique_code);
  const notifications = await getLatestDashboardNotifications(business_unique_code,5);

  return {
     business_name: snapshot.business_name,
    today_sales: Number(snapshot.today_sales),
    pending_payments: Number(snapshot.pending_payments),
    low_stock_items: Number(snapshot.low_stock_items),
    payment_reminders: Number(snapshot.payment_reminders),
    notifications
  };
};

export const getAllNotificationsService = async (business_unique_code) => {
  const notifications = await getAllNotifications(business_unique_code);
  return notifications;
};
