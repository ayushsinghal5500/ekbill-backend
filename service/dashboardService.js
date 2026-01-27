import {getDashboardSnapshot,getLatestDashboardNotifications,getAllNotifications} from "../models/dashboardModel.js";

export const getDashboardService = async (user_unique_code) => {
  const snapshot = await getDashboardSnapshot(user_unique_code);
  const notifications = await getLatestDashboardNotifications(user_unique_code,5);

  return {
    today_sales: Number(snapshot.today_sales),
    pending_payments: Number(snapshot.pending_payments),
    low_stock_items: Number(snapshot.low_stock_items),
    payment_reminders: Number(snapshot.payment_reminders),
    notifications
  };
};

export const getAllNotificationsService = async (user_unique_code) => {
  const notifications = await getAllNotifications(user_unique_code);
  return notifications;
};
