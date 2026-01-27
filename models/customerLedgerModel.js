import { generateUniqueCode } from "../utils/codeGenerator.js";

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
    reference_bill_code,
    user_unique_code
  },
  client
) => {
  const ledger_unique_code = generateUniqueCode("LEDGER");

  const res = await client.query(
    `INSERT INTO ekbill.customer_ledger
     (ledger_unique_code,business_unique_code,customer_unique_code,transaction_type,transaction_source,payment_mode,amount,balance_before,balance_after,reference_bill_code,created_by,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
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
      reference_bill_code || null,
      user_unique_code
    ]
  );

  return res.rows[0];
};

export const getLastCustomerBalance = async (business_unique_code, customer_unique_code, client) => {
  const res = await client.query(
    `SELECT balance_after
     FROM ekbill.customer_ledger
     WHERE business_unique_code=$1 AND customer_unique_code=$2
     ORDER BY entry_datetime DESC
     LIMIT 1`,
    [business_unique_code, customer_unique_code]
  );

  return res.rows.length ? Number(res.rows[0].balance_after) : 0;
};
