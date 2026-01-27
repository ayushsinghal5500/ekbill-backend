import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

/* ================= UPSERT CUSTOMER ================= */
export const upsertCustomer = async ({ business_unique_code, customer_name, phone, country_code, user_unique_code }) => {
  const customer_unique_code = generateUniqueCode({ table: "CUST" });

  const res = await pool.query(
    `INSERT INTO ekbill.customers
     (customer_unique_code, business_unique_code, added_by_user_unique_code, customer_name, customer_phone, customer_country_code)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (business_unique_code, customer_phone)
     DO NOTHING
     RETURNING customer_unique_code, customer_name, customer_phone;`,
    [customer_unique_code, business_unique_code, user_unique_code, customer_name, phone, country_code]
  );

  if (res.rows.length) return { isNew: true, customer: res.rows[0] };

  const existing = await pool.query(
    `SELECT customer_unique_code, customer_name, customer_phone
     FROM ekbill.customers
     WHERE business_unique_code=$1 AND customer_phone=$2`,
    [business_unique_code, phone]
  );

  return { isNew: false, customer: existing.rows[0] };
};

/* ================= UPSERT CUSTOMER DETAILS ================= */
export const upsertCustomerDetails = async (customer_unique_code, { gender, dob, anniversary, gstin, notes }) => {
  await pool.query(
    `INSERT INTO ekbill.customer_details (customer_unique_code, gender, dob, anniversary, gstin, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (customer_unique_code)
     DO UPDATE SET
       gender = EXCLUDED.gender,
       dob = EXCLUDED.dob,
       anniversary = EXCLUDED.anniversary,
       gstin = EXCLUDED.gstin,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [customer_unique_code, gender || null, dob || null, anniversary || null, gstin || null, notes || null]
  );
};

/* ================= INSERT CUSTOMER ADDRESS ================= */
export const insertCustomerAddress = async (customer_unique_code, user_unique_code, addr) => {
  const address_unique_code = generateUniqueCode({ table: "ADDR" });

  const addressLine1 = addr.full_address
    ? addr.full_address
    : [addr.flat_no, addr.area].filter(Boolean).join(", ") || null;

  await pool.query(
    `INSERT INTO ekbill.addresses
     (address_unique_code, address_label, address_line1, city, state, postal_code, created_by)
     VALUES ($1,'Customer Address',$2,$3,$4,$5,$6)`,
    [address_unique_code, addressLine1, addr.city || null, addr.state || null, addr.pincode || null, user_unique_code]
  );

  await pool.query(
    `INSERT INTO ekbill.entity_addresses
     (address_unique_code, entity_unique_code, entity_type, address_role, is_primary, created_by)
     VALUES ($1,$2,'customer','billing',true,$3)`,
    [address_unique_code, customer_unique_code, user_unique_code]
  );
};

/* ================= REPLACE CUSTOMER ADDRESS ================= */
export const replaceCustomerAddress = async (customer_unique_code, user_unique_code, addr) => {
  await pool.query(
    `DELETE FROM ekbill.entity_addresses
     WHERE entity_unique_code=$1 AND entity_type='customer'`,
    [customer_unique_code]
  );

  await insertCustomerAddress(customer_unique_code, user_unique_code, addr);
};

/* ================= UPDATE CUSTOMER CORE ================= */
export const updateCustomerCore = async (
  business_unique_code,
  customer_unique_code,
  { customer_name, phone, country_code }
) => {
  try {
    await pool.query(
      `UPDATE ekbill.customers
       SET customer_name=$1,
           customer_phone=$2,
           customer_country_code=$3,
           updated_at=NOW()
       WHERE business_unique_code=$4
         AND customer_unique_code=$5`,
      [customer_name, phone, country_code, business_unique_code, customer_unique_code]
    );
  } catch (err) {
    if (err.code === "23505") {
      throw new Error("Another customer already exists with this phone number");
    }
    throw err;
  }
};

/* ================= GET MINIMAL CUSTOMER LIST ================= */
export const getMinimalCustomerList = async (business_unique_code) => {
  const res = await pool.query(
    `SELECT customer_unique_code, customer_name, customer_phone AS phone, customer_country_code AS country_code
     FROM ekbill.customers
     WHERE business_unique_code=$1
       AND customer_phone IS NOT NULL
       AND is_deleted = FALSE
     ORDER BY customer_name ASC`,
    [business_unique_code]
  );
  return res.rows;
};

/* ================= SOFT DELETE CUSTOMER ================= */
export const deleteCustomer = async (business_unique_code, customer_unique_code) => {
  const res = await pool.query(
    `UPDATE ekbill.customers
     SET is_deleted = TRUE, updated_at = NOW()
     WHERE business_unique_code=$1 AND customer_unique_code=$2
     RETURNING customer_unique_code, customer_name, customer_phone`,
    [business_unique_code, customer_unique_code]
  );

  if (!res.rows.length) {
    throw new Error("Customer not found or not belonging to this business");
  }

  return res.rows[0];
};

/* ================= UPDATE COLLECTION REMINDER ================= */
export const updateCollectionReminderDate = async (customer_unique_code, collection_reminder_date) => {
  const res = await pool.query(
    `UPDATE ekbill.customer_details
     SET collection_reminder_date=$1, updated_at=NOW()
     WHERE customer_unique_code=$2
     RETURNING customer_unique_code, collection_reminder_date`,
    [collection_reminder_date || null, customer_unique_code]
  );

  return res.rows[0];
};

/* ================= GET LAST CUSTOMER BALANCE ================= */
export const getLastCustomerBalance = async (customer_unique_code, client = pool) => {
  const res = await client.query(
    `SELECT balance_after
     FROM ekbill.customer_ledger
     WHERE customer_unique_code=$1
     ORDER BY entry_datetime DESC
     LIMIT 1`,
    [customer_unique_code]
  );
  return res.rows.length ? Number(res.rows[0].balance_after) : 0;
};


/* ================= ADD CUSTOMER LEDGER ENTRY ================= */
export const addCustomerLedgerEntry = async ({
  business_unique_code,
  customer_unique_code,
  transaction_type,
  transaction_source,
  payment_mode,
  amount,
  balance_before,
  balance_after,
  note,
  reference_bill_code,
  created_by
}, client = pool) => {

  const ledger_unique_code = generateUniqueCode({ table: "LEDGER" });

  const res = await client.query(
    `INSERT INTO ekbill.customer_ledger
     (ledger_unique_code, business_unique_code, customer_unique_code,
      transaction_type, transaction_source, payment_mode, amount,
      balance_before, balance_after, note, reference_bill_code, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      ledger_unique_code,
      business_unique_code,
      customer_unique_code,
      transaction_type,
      transaction_source,
      payment_mode,
      amount,
      balance_before,
      balance_after,
      note ?? null,
      reference_bill_code ?? null,
      created_by
    ]
  );

  return res.rows[0];
};


export const getCustomerDetails = async (customer_unique_code, business_unique_code) => {
  const cust = await pool.query(
    `SELECT c.customer_unique_code,
            c.customer_name,
            c.customer_phone,
            c.customer_country_code,
            d.collection_reminder_date
     FROM ekbill.customers c
     LEFT JOIN ekbill.customer_details d 
       ON c.customer_unique_code = d.customer_unique_code
     WHERE c.customer_unique_code = $1 
       AND c.business_unique_code = $2`,
    [customer_unique_code, business_unique_code]
  );

  if (!cust.rows.length) return null;

  const summary = await pool.query(
    `SELECT 
        COALESCE(SUM(CASE WHEN transaction_type='YOU_GAVE' THEN amount ELSE 0 END),0) AS you_gave,
        COALESCE(SUM(CASE WHEN transaction_type='YOU_GOT' THEN amount ELSE 0 END),0) AS you_got
     FROM ekbill.customer_ledger
     WHERE customer_unique_code=$1 
       AND business_unique_code=$2`,
    [customer_unique_code, business_unique_code]
  );

  const entries = await pool.query(
    `SELECT ledger_unique_code,
            transaction_type,
            amount,
            balance_after,
            transaction_source,
            entry_datetime
     FROM ekbill.customer_ledger
     WHERE customer_unique_code=$1 
       AND business_unique_code=$2
     ORDER BY entry_datetime DESC`,
    [customer_unique_code, business_unique_code]
  );

  return {
    customer: cust.rows[0],
    summary: summary.rows[0],
    entries: entries.rows
  };
};
