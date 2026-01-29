import pool from "../config/dbConnection.js";
import {createBillModel,getBillDetails,getBillsList,} from "../models/billCreateModel.js";
import { addItem } from "../models/billItemsModel.js";
import { addCharge } from "../models/billChargesModel.js";
import { addDiscount } from "../models/billDiscountsModel.js";
import { addPayment } from "../models/BillPaymentsModel.js";
import {
  addCustomerLedgerEntry,
  getLastCustomerBalance,
} from "../models/customerLedgerModel.js";
import { handleLowStockAlert } from "../utils/lowStockAlert.js";

export const createBillService = async (data) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { business_unique_code, user_unique_code } = data;
    if (!business_unique_code) throw new Error("Business missing");
    if (!user_unique_code) throw new Error("User missing");
    if (!data.bill?.invoice_number) throw new Error("Invoice missing");
    if (!data.bill?.grand_total) throw new Error("Grand total missing");

    const grand_total = Number(data.bill.grand_total);
    let totalPaid = 0;

    // 🔹 CREATE BILL
    const bill = await createBillModel(
      {
        ...data.bill,
        business_unique_code,
        user_unique_code,
      },
      client,
    );

    const bill_unique_code = bill.bill_unique_code;

    // 🔹 ITEMS + STOCK
    const processedProducts = new Set(); // Track products for low stock alert

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        // Validate item
        if (!item.product_unique_code) {
          throw new Error("Product unique code is required for items");
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          throw new Error(
            `Invalid quantity for product ${item.product_unique_code}`,
          );
        }

        // Lock rows for this product first
        await client.query(
          `SELECT 1 FROM ekbill.product_stock_history
           WHERE product_unique_code=$1 AND business_unique_code=$2
           FOR UPDATE`,
          [item.product_unique_code, business_unique_code],
        );

        // Get current stock
        const stockRes = await client.query(
          `SELECT COALESCE(SUM(
              CASE WHEN transaction_type IN ('OPENING','IN') THEN quantity
                   WHEN transaction_type='OUT' THEN -quantity END
            ),0) AS current_stock
           FROM ekbill.product_stock_history
           WHERE product_unique_code=$1 AND business_unique_code=$2`,
          [item.product_unique_code, business_unique_code],
        );

        const current_stock = Number(stockRes.rows[0].current_stock);
        const quantity = Number(item.quantity);

        if (current_stock < quantity) {
          throw new Error(
            `Insufficient stock for product ${item.product_unique_code}. Available: ${current_stock}, Required: ${quantity}`,
          );
        }

        // Add item to bill
        await addItem({ ...item, bill_unique_code }, client);

        // Update stock history
        await client.query(
          `INSERT INTO ekbill.product_stock_history
           (history_unique_code, product_unique_code, business_unique_code, 
            transaction_type, transaction_source, reference_bill_code, 
            quantity, unit, price, note, created_by)
           VALUES (gen_random_uuid()::text, $1, $2, 'OUT', 'BILL', $3, 
                   $4, $5, $6, $7, $8)`,
          [
            item.product_unique_code,
            business_unique_code,
            bill_unique_code,
            quantity,
            item.unit || "PCS",
            item.selling_price || 0,
            `Sold in bill ${bill.invoice_number}`,
            user_unique_code,
          ],
        );

        // 🔹 Check low stock alert (only once per product in this transaction)
        if (!processedProducts.has(item.product_unique_code)) {
          await handleLowStockAlert(
            {
              product_unique_code: item.product_unique_code,
              business_unique_code,
            },
            client,
          );
          processedProducts.add(item.product_unique_code);
        }
      }
    }

    // 🔹 CHARGES
    if (Array.isArray(data.charges)) {
      for (const charge of data.charges) {
        if (charge.amount && Number(charge.amount) > 0) {
          await addCharge({ ...charge, bill_unique_code }, client);
        }
      }
    }

    // 🔹 DISCOUNTS
    if (Array.isArray(data.discounts)) {
      for (const discount of data.discounts) {
        if (discount.amount && Number(discount.amount) > 0) {
          await addDiscount({ ...discount, bill_unique_code }, client);
        }
      }
    }

    // 🔹 PAYMENTS
    const processPayment = async (mode, amount) => {
      if (!bill.customer_unique_code)
        throw new Error("Customer required for payments");

      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) return;

      await addPayment(
        {
          bill_unique_code,
          user_unique_code,
          customer_unique_code: bill.customer_unique_code,
          payment_mode: mode,
          amount_paid: paymentAmount,
        },
        client,
      );

      totalPaid += paymentAmount;

      const balance_before = await getLastCustomerBalance(
        business_unique_code,
        bill.customer_unique_code,
        client,
      );
      const balance_after = balance_before - paymentAmount;

      await addCustomerLedgerEntry(
        {
          business_unique_code,
          customer_unique_code: bill.customer_unique_code,
          transaction_type: "YOU_GOT",
          transaction_source: "BILL",
          payment_mode: mode,
          amount: paymentAmount,
          balance_before,
          balance_after,
          reference_bill_code: bill_unique_code,
          user_unique_code,
        },
        client,
      );
    };

    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        if (p.mode && p.amount) {
          await processPayment(p.mode, Number(p.amount));
        }
      }
    }

    // 🔹 DUE ENTRY
    if (bill.customer_unique_code && grand_total > totalPaid) {
      const due = grand_total - totalPaid;
      const balance_before = await getLastCustomerBalance(
        business_unique_code,
        bill.customer_unique_code,
        client,
      );
      const balance_after = balance_before + due;

      await addCustomerLedgerEntry(
        {
          business_unique_code,
          customer_unique_code: bill.customer_unique_code,
          transaction_type: "YOU_GAVE",
          transaction_source: "BILL",
          payment_mode: "OTHER",
          amount: due,
          balance_before,
          balance_after,
          reference_bill_code: bill_unique_code,
          user_unique_code,
        },
        client,
      );
    }

    await client.query("COMMIT");

    // Get final bill details with payment summary
    const billDetails = await client.query(
      `SELECT b.*,
          COALESCE((
            SELECT SUM(p.amount_paid)
            FROM ekbill.bill_payments p
            WHERE p.bill_unique_code = b.bill_unique_code
          ), 0) AS total_paid
          FROM ekbill.bills b   
          WHERE b.bill_unique_code = $1`,      
          [bill_unique_code],   
        );

    const finalBill = billDetails.rows[0];

    return {
      ...finalBill,
      paid_amount: totalPaid,
      remaining_due: grand_total - totalPaid,
      payment_status:
        totalPaid >= grand_total
          ? "PAID"
          : totalPaid > 0
            ? "PARTIAL"
            : "UNPAID",
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Bill creation error:", err);
    throw err;
  } finally {
    client.release();
  }
};

export const getBillsListService = async (business_unique_code) => {
  if (!business_unique_code)
    throw new Error("Business unique code is required");
  return await getBillsList(business_unique_code);
};

export const getBillDetailsService = async (
  bill_unique_code,
  business_unique_code,
) => {
  if (!bill_unique_code) throw new Error("Bill code is required");
  if (!business_unique_code) throw new Error("Business code is required");

  const data = await getBillDetails(bill_unique_code, business_unique_code);
  if (!data) throw new Error("Bill not found");

  return data;
};
