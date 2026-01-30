import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

/* ================= UPSERT CUSTOMER ================= */
export const upsertCustomer = async ({
  business_unique_code,
  customer_name,
  phone,
  country_code,
  user_unique_code
}) => {
  try {
    const customer_unique_code = generateUniqueCode({ table: "CUST" });

    const res = await pool.query(
      `INSERT INTO ekbill.customers
       (customer_unique_code, business_unique_code, added_by_user_unique_code, customer_name, customer_phone, customer_country_code)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (business_unique_code, customer_phone)
       DO NOTHING
       RETURNING customer_unique_code, customer_name, customer_phone, customer_country_code;`,
      [customer_unique_code, business_unique_code, user_unique_code, customer_name, phone, country_code]
    );

    if (res.rows.length) {
      return { 
        isNew: true, 
        customer: res.rows[0] 
      };
    }

    // Customer already exists, fetch existing data
    const existing = await pool.query(
      `SELECT customer_unique_code, customer_name, customer_phone, customer_country_code
       FROM ekbill.customers
       WHERE business_unique_code=$1 AND customer_phone=$2`,
      [business_unique_code, phone]
    );

    return { 
      isNew: false, 
      customer: existing.rows[0] 
    };
  } catch (error) {
    console.error("upsertCustomer error:", error);
    throw new Error("Failed to create or fetch customer");
  }
};

/* ================= UPSERT CUSTOMER DETAILS ================= */
export const upsertCustomerDetails = async (
  customer_unique_code,
  { gender, dob, anniversary, gstin, notes }
) => {
  try {
    await pool.query(
      `INSERT INTO ekbill.customer_details (customer_unique_code, gender, dob, anniversary, gstin, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (customer_unique_code)
       DO UPDATE SET
         gender = COALESCE(EXCLUDED.gender, customer_details.gender),
         dob = COALESCE(EXCLUDED.dob, customer_details.dob),
         anniversary = COALESCE(EXCLUDED.anniversary, customer_details.anniversary),
         gstin = COALESCE(EXCLUDED.gstin, customer_details.gstin),
         notes = COALESCE(EXCLUDED.notes, customer_details.notes),
         updated_at = NOW()`,
      [
        customer_unique_code,
        gender || null,
        dob || null,
        anniversary || null,
        gstin || null,
        notes || null
      ]
    );
  } catch (error) {
    console.error("upsertCustomerDetails error:", error);
    throw new Error("Failed to update customer details");
  }
};

/* ================= INSERT CUSTOMER ADDRESS ================= */
export const insertCustomerAddress = async (
  customer_unique_code,
  user_unique_code,
  addr
) => {
  try {
    // Prepare address line 1
    let addressLine1 = null;
    
    if (addr.full_address) {
      // Priority 1: full_address field
      addressLine1 = addr.full_address;
    } else if (addr.flat_no || addr.area) {
      // Priority 2: Combine flat_no and area
      addressLine1 = [addr.flat_no, addr.area].filter(Boolean).join(", ");
    }

    // Only insert if we have at least some address data
    if (!addressLine1 && !addr.city && !addr.state && !addr.pincode) {
      return; // No address data to insert
    }

    const address_unique_code = generateUniqueCode({ table: "ADDR" });

    await pool.query(
      `INSERT INTO ekbill.addresses
       (address_unique_code, address_label, address_line1, city, state, postal_code, created_by)
       VALUES ($1,'Customer Address',$2,$3,$4,$5,$6)`,
      [
        address_unique_code,
        addressLine1,
        addr.city || null,
        addr.state || null,
        addr.pincode || null,
        user_unique_code
      ]
    );

    await pool.query(
      `INSERT INTO ekbill.entity_addresses
       (address_unique_code, entity_unique_code, entity_type, address_role, is_primary, created_by)
       VALUES ($1,$2,'customer','billing',true,$3)`,
      [address_unique_code, customer_unique_code, user_unique_code]
    );
  } catch (error) {
    console.error("insertCustomerAddress error:", error);
    throw new Error("Failed to insert customer address");
  }
};

/* ================= REPLACE CUSTOMER ADDRESS ================= */
export const replaceCustomerAddress = async (
  customer_unique_code,
  user_unique_code,
  addr
) => {
  try {
    // Delete existing addresses for this customer
    await pool.query(
      `DELETE FROM ekbill.entity_addresses
       WHERE entity_unique_code=$1 AND entity_type='customer'`,
      [customer_unique_code]
    );

    // Insert new address
    await insertCustomerAddress(customer_unique_code, user_unique_code, addr);
  } catch (error) {
    console.error("replaceCustomerAddress error:", error);
    throw new Error("Failed to update customer address");
  }
};

/* ================= UPDATE CUSTOMER CORE ================= */
export const updateCustomerCore = async (
  business_unique_code,
  customer_unique_code,
  { customer_name, phone, country_code }
) => {
  try {
    const result = await pool.query(
      `UPDATE ekbill.customers
       SET customer_name=$1,
           customer_phone=$2,
           customer_country_code=$3,
           updated_at=NOW()
       WHERE business_unique_code=$4
         AND customer_unique_code=$5
         AND is_deleted=FALSE
       RETURNING customer_unique_code`,
      [customer_name, phone, country_code, business_unique_code, customer_unique_code]
    );

    if (result.rows.length === 0) {
      throw new Error("Customer not found or already deleted");
    }
  } catch (error) {
    console.error("updateCustomerCore error:", error);
    
    if (error.code === "23505") {
      throw new Error("Another customer already exists with this phone number");
    }
    
    throw new Error(error.message || "Failed to update customer");
  }
};

/* ================= GET MINIMAL CUSTOMER LIST ================= */
export const getMinimalCustomerList = async (business_unique_code) => {
  try {
    const res = await pool.query(
      `SELECT customer_unique_code, 
              customer_name, 
              customer_phone AS phone, 
              customer_country_code AS country_code
       FROM ekbill.customers
       WHERE business_unique_code=$1
         AND customer_phone IS NOT NULL
         AND is_deleted = FALSE
       ORDER BY customer_name ASC`,
      [business_unique_code]
    );
    return res.rows;
  } catch (error) {
    console.error("getMinimalCustomerList error:", error);
    throw new Error("Failed to fetch customer list");
  }
};

/* ================= SOFT DELETE CUSTOMER ================= */
export const deleteCustomer = async (business_unique_code, customer_unique_code) => {
  try {
    const res = await pool.query(
      `UPDATE ekbill.customers
       SET is_deleted = TRUE, updated_at = NOW()
       WHERE business_unique_code=$1 
         AND customer_unique_code=$2
         AND is_deleted = FALSE
       RETURNING customer_unique_code, customer_name, customer_phone`,
      [business_unique_code, customer_unique_code]
    );

    if (!res.rows.length) {
      throw new Error("Customer not found or already deleted");
    }

    return res.rows[0];
  } catch (error) {
    console.error("deleteCustomer error:", error);
    throw new Error(error.message || "Failed to delete customer");
  }
};

/* ================= UPDATE COLLECTION REMINDER ================= */
export const updateCollectionReminderDate = async (
  customer_unique_code,
  collection_reminder_date
) => {
  try {
    const res = await pool.query(
      `UPDATE ekbill.customer_details
       SET collection_reminder_date=$1, updated_at=NOW()
       WHERE customer_unique_code=$2
       RETURNING customer_unique_code, collection_reminder_date`,
      [collection_reminder_date || null, customer_unique_code]
    );

    if (!res.rows.length) {
      throw new Error("Customer details not found");
    }

    return res.rows[0];
  } catch (error) {
    console.error("updateCollectionReminderDate error:", error);
    throw new Error(error.message || "Failed to update collection reminder");
  }
};

/* ================= GET LAST CUSTOMER BALANCE ================= */
export const getLastCustomerBalance = async (customer_unique_code, client = pool) => {
  try {
    const res = await client.query(
      `SELECT balance_after
       FROM ekbill.customer_ledger
       WHERE customer_unique_code=$1
       ORDER BY entry_datetime DESC
       LIMIT 1`,
      [customer_unique_code]
    );
    return res.rows.length ? Number(res.rows[0].balance_after) : 0;
  } catch (error) {
    console.error("getLastCustomerBalance error:", error);
    throw new Error("Failed to fetch customer balance");
  }
};

/* ================= ADD CUSTOMER LEDGER ENTRY ================= */
export const addCustomerLedgerEntry = async (
  {
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
  },
  client = pool
) => {
  try {
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
  } catch (error) {
    console.error("addCustomerLedgerEntry error:", error);
    throw new Error("Failed to add ledger entry");
  }
};

/* ================= GET CUSTOMER DETAILS ================= */
export const getCustomerDetails = async (
  customer_unique_code,
  business_unique_code
) => {
  try {
    // Get customer basic info
    const cust = await pool.query(
      `SELECT c.customer_unique_code,
              c.customer_name,
              c.customer_phone,
              c.customer_country_code,
              d.collection_reminder_date,
              d.gender,
              d.dob,
              d.anniversary,
              d.gstin,
              d.notes
       FROM ekbill.customers c
       LEFT JOIN ekbill.customer_details d 
         ON c.customer_unique_code = d.customer_unique_code
       WHERE c.customer_unique_code = $1 
         AND c.business_unique_code = $2
         AND c.is_deleted = FALSE`,
      [customer_unique_code, business_unique_code]
    );

    if (!cust.rows.length) {
      return null;
    }

    // Get customer address
    const address = await pool.query(
      `SELECT a.address_line1, a.city, a.state, a.postal_code
       FROM ekbill.addresses a
       INNER JOIN ekbill.entity_addresses ea 
         ON a.address_unique_code = ea.address_unique_code
       WHERE ea.entity_unique_code = $1 
         AND ea.entity_type = 'customer'
       LIMIT 1`,
      [customer_unique_code]
    );

    // Get ledger summary
    const summary = await pool.query(
      `SELECT 
          COALESCE(SUM(CASE WHEN transaction_type='YOU_GAVE' THEN amount ELSE 0 END),0) AS you_gave,
          COALESCE(SUM(CASE WHEN transaction_type='YOU_GOT' THEN amount ELSE 0 END),0) AS you_got
       FROM ekbill.customer_ledger
       WHERE customer_unique_code=$1 
         AND business_unique_code=$2`,
      [customer_unique_code, business_unique_code]
    );

    // Get ledger entries
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
      customer: {
        ...cust.rows[0],
        address: address.rows.length > 0 ? address.rows[0] : null
      },
      summary: summary.rows[0],
      entries: entries.rows
    };
  } catch (error) {
    console.error("getCustomerDetails error:", error);
    throw new Error("Failed to fetch customer details");
  }
};