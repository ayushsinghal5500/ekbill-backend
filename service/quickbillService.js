import { insertQuickBill, insertQuickBillItems, insertQuickBillPayments, insertQuickBillCharges,getQuickBillsList ,getQuickBillDetails } from "../models/quickbillModel.js";
import pool from "../config/dbConnection.js";

export const createQuickBillService = async (data) => {
  let { bill, items = [], payments = [], charges = [], business_unique_code, created_by } = data;

  if (!business_unique_code) throw new Error("Business unique code is required");
  if (!bill || typeof bill !== "object") throw new Error("Bill data is required");

  // ---- Numeric Safety ----
  bill.subtotal = Number(bill.subtotal || 0);
  bill.discount_value = Number(bill.discount_value || 0);
  bill.discount_amount = Number(bill.discount_amount || 0);
  bill.gst_percentage = Number(bill.gst_percentage || 0);
  bill.cgst_amount = Number(bill.cgst_amount || 0);
  bill.sgst_amount = Number(bill.sgst_amount || 0);
  bill.igst_amount = Number(bill.igst_amount || 0);
  bill.total_gst_amount = Number(bill.total_gst_amount || 0);
  bill.grand_total = Number(bill.grand_total || 0);

  // ---- Flags ----
  bill.has_discount = !!bill.has_discount;
  bill.has_gst = !!bill.has_gst;

  // ---- Discount Rules ----
  if (!bill.has_discount) {
    bill.discount_type = null;
    bill.discount_value = 0;
    bill.discount_amount = 0;
  } else {
    if (!["FLAT", "PERCENT"].includes(bill.discount_type)) throw new Error("Invalid discount type");
    if (bill.discount_value < 0) throw new Error("Discount value cannot be negative");
    if (bill.discount_type === "PERCENT" && bill.discount_value > 100) throw new Error("Discount percent cannot exceed 100");
  }

  // ---- GST Rules ----
  if (!bill.has_gst) {
    bill.gst_type = null;
    bill.gst_percentage = 0;
    bill.is_gst_inclusive = false;
    bill.cgst_amount = 0;
    bill.sgst_amount = 0;
    bill.igst_amount = 0;
    bill.total_gst_amount = 0;
  }

  // ---- Payment Remaining Due Calculation ----
  if (payments.length) {
    let remaining = bill.grand_total;
    payments = payments.map(p => {
      remaining -= Number(p.amount);
      return { ...p, remaining_due: remaining < 0 ? 0 : remaining };
    });
  }

  // ---- CREDIT Payment Rule ----
  const hasCreditPayment = payments.some(p => p.payment_mode === "CREDIT");
  if (hasCreditPayment) {
    if (!bill.customer_name || !bill.customer_phone)
      throw new Error("Customer name and phone are required for credit payments");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const quick_bill_unique_code = await insertQuickBill(client, { ...bill, business_unique_code, created_by });

    if (items.length)
      await insertQuickBillItems(client, quick_bill_unique_code, items);

    if (charges.length)
      await insertQuickBillCharges(client, quick_bill_unique_code, charges);

    if (payments.length)
      await insertQuickBillPayments(client, quick_bill_unique_code, payments, created_by);

    await client.query("COMMIT");
    return { quick_bill_unique_code };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


export const getQuickBillsListService = async (business_unique_code) => {
  if (!business_unique_code) throw new Error("Business unique code is required");
  return await getQuickBillsList(business_unique_code);
};

/* ================= GET QUICK BILLS LIST ================= */
export const getQuickBillDetailsService = async (quick_bill_unique_code, business_unique_code) => {
  if (!quick_bill_unique_code) throw new Error("Bill code is required");
  if (!business_unique_code) throw new Error("Business code is required");

  const data = await getQuickBillDetails(quick_bill_unique_code, business_unique_code);
  if (!data) throw new Error("Bill not found");

  return data;
};