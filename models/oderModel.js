import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

/* ---------------- PHONE HELPER ---------------- */
const extractPhoneParts = (rawPhone) => {
  const cleaned = rawPhone.replace(/\s+/g, "");
  return {
    country_code: cleaned.slice(0, 3), // +91
    phone: cleaned.slice(3),
  };
};

/* ---------------- 1️⃣ STORE → BUSINESS ---------------- */
export const getBusinessCodeFromSlug = async (storeSlug) => {
  const { rows } = await pool.query(
    `SELECT business_unique_code
     FROM ekbill.public_stores
     WHERE public_slug = $1
       AND is_active = TRUE
       AND is_accepting_orders = TRUE
     LIMIT 1`,
    [storeSlug],
  );

  if (!rows.length) throw new Error("Store not found or not accepting orders");
  return rows[0].business_unique_code;
};

/* ---------------- 2️⃣ CUSTOMER + ADDRESS ---------------- */
export const findOrCreateCustomerWithAddress = async (
  businessCode,
  customerData,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { name, phone, address } = customerData;
    const { country_code, phone: purePhone } = extractPhoneParts(phone);

    const { rows } = await client.query(
      `SELECT customer_unique_code
       FROM ekbill.customers
       WHERE business_unique_code = $1
         AND customer_phone = $2
         AND customer_country_code = $3
         AND is_deleted = FALSE
       LIMIT 1`,
      [businessCode, purePhone, country_code],
    );

    let customerCode;

    if (rows.length) {
      customerCode = rows[0].customer_unique_code;
      console.log("👤 Existing customer:", customerCode);
    } else {
      customerCode = generateUniqueCode("CUST");

      await client.query(
        `INSERT INTO ekbill.customers (
      customer_unique_code,
      business_unique_code,
      customer_name,
      customer_phone,
      customer_country_code
    )
    VALUES ($1, $2, $3, $4, $5)`,
        [customerCode, businessCode, name, purePhone, country_code],
      );

      console.log("🆕 New customer created:", customerCode);
    }

    const addressCode = generateUniqueCode("ADDR");

    await client.query(
      `INSERT INTO ekbill.addresses
       (address_unique_code, address_label, address_line1, created_by)
       VALUES ($1,'Billing',$2,'SYSTEM')`,
      [addressCode, address],
    );

    await client.query(
      `INSERT INTO ekbill.entity_addresses
       (address_unique_code, entity_unique_code, entity_type, address_role, is_primary, created_by)
       VALUES ($1,$2,'CUSTOMER','BILLING',TRUE,'SYSTEM')`,
      [addressCode, customerCode],
    );

    await client.query("COMMIT");
    return customerCode;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

/* ---------------- 3️⃣ ORDER + ITEMS + NOTIFICATIONS ---------------- */
export const createOrderWithItems = async (
  businessCode,
  customerCode,
  customerData,
  items,
  totals,
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderCode = generateUniqueCode("ORD");
    const { country_code, phone } = extractPhoneParts(customerData.phone);

    // 🧾 Order Header
    await client.query(
      `INSERT INTO ekbill.orders (
        order_unique_code,
        business_unique_code,
        customer_unique_code,
        customer_name,
        customer_phone,
        country_code,
        address,
        order_total,
        order_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PLACED')`,
      [
        orderCode,
        businessCode,
        customerCode,
        customerData.name,
        phone,
        country_code,
        customerData.address,
        totals.items_total,
      ],
    );

    // 🛒 Items
    for (const item of items) {
      const itemCode = generateUniqueCode("OITEM");

      await client.query(
        `INSERT INTO ekbill.order_items (
          order_item_unique_code,
          order_unique_code,
          product_unique_code,
          product_name,
          quantity,selling_price,is_gst_inclusive,gst_percentage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          itemCode,
          orderCode,
          item.product_unique_code,
          item.product_name,
          item.qty,
          item.selling_price,
          item.is_gst_inclusive,
          item.gst_percentage,
        ],
      );
    }

    // 📌 Action Request
    const actionRequestCode = generateUniqueCode("ACTREQ");

    await client.query(
      `INSERT INTO ekbill.action_requests (request_unique_code, business_unique_code, module,  reference_code,requested_by_type,requested_by_code,status) VALUES ($1,$2,'ORDER',$3,'CUSTOMER',$4,'PENDING')`,
      [actionRequestCode, businessCode, orderCode, customerCode],
    );

    // 🔔 Notification
    const notificationCode = generateUniqueCode("NOTIF");

    await client.query(
      `INSERT INTO ekbill.notifications ( notification_unique_code,  business_unique_code,title, message, type,module, reference_code, actor_type, actor_code, action, action_request_code) VALUES ($1,$2,$3,$4,'ALERT','ORDER',$5,'CUSTOMER',$6,'VIEW_ORDER',$7)`,
      [
        notificationCode,
        businessCode,
        "New Order Received",
        `You have received a new order from ${customerData.name}`,
        orderCode,
        customerCode,
        actionRequestCode,
      ],
    );

    await client.query("COMMIT");
    console.log("✅ Full Order Flow Completed:", orderCode);

    return orderCode;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Order Transaction Failed:", err);
    throw err;
  } finally {
    client.release();
  }
};
