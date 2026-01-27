import pool from "../config/dbConnection.js";
import {upsertCustomer,insertCustomerAddress, updateCustomerCore, replaceCustomerAddress, upsertCustomerDetails, getMinimalCustomerList, deleteCustomer, updateCollectionReminderDate, addCustomerLedgerEntry, getLastCustomerBalance,getCustomerDetails} from "../models/customerModel.js";
import { createNotification } from "../models/notificationModel.js";

export const createCustomerService = async (data) => {
  const {
    business_unique_code,
    user_unique_code,
    customer_name,
    phone,
    country_code,
    gender,
    dob,
    anniversary,
    gstin,
    notes,
    address
  } = data;

  const result = await upsertCustomer({
    business_unique_code,
    customer_name,
    phone,
    country_code,
    user_unique_code
  });

  const customerCode = result.customer.customer_unique_code;

  // If already exists
  if (!result.isNew) {
    return {
      success: true,
      exists: true,
      message: "Customer already exists with this phone number",
      customer: result.customer
    };
  }

  // Optional details
  if (gender || dob || anniversary || gstin || notes) {
    await upsertCustomerDetails(customerCode, {
      gender,
      dob,
      anniversary,
      gstin,
      notes
    });
  }

  // Optional address
  if (address) {
    await insertCustomerAddress(customerCode, user_unique_code, address);
  }

  return {
    success: true,
    exists: false,
    message: "Customer created successfully",
    customer: result.customer
  };
};

export const updateCustomerService = async (data) => {
  const {
    business_unique_code,
    user_unique_code,
    customer_unique_code,
    customer_name,
    phone,
    country_code,
    gender,
    dob,
    anniversary,
    gstin,
    notes,
    address,
  } = data;

  await updateCustomerCore(business_unique_code, customer_unique_code, {
    customer_name,
    phone,
    country_code,
  });
  await upsertCustomerDetails(customer_unique_code, {
    gender,
    dob,
    anniversary,
    gstin,
    notes,
  });

  if (address)
    await replaceCustomerAddress(
      customer_unique_code,
      user_unique_code,
      address,
    );

  return { customer_unique_code };
};

export const getMinimalCustomerListService = async (business_unique_code) =>
  getMinimalCustomerList(business_unique_code);

export const deleteCustomerService = async (business_unique_code,user_unique_code,customer_unique_code,) => {
  const deletedCustomer = await deleteCustomer(business_unique_code,customer_unique_code,);

  await createNotification({
    business_unique_code,
    recipient_user_code: user_unique_code,
    title: "Customer deleted",
    message: `${deletedCustomer.customer_name} has been deleted`,
    type: "NOTIFICATION",
    module: "CUSTOMER",
    reference_code: customer_unique_code,
    actor_type: "OWNER",
    actor_code: user_unique_code,
    action: "CUSTOMER_DELETED",
  });

  return deletedCustomer;
};

export const updateCollectionReminderDateService = async (
  customer_unique_code,
  collection_reminder_date,
) => {
  const result = await updateCollectionReminderDate(
    customer_unique_code,
    collection_reminder_date,
  );

  if (!result) {
    throw new Error("Customer details not found");
  }

  return result;
};

export const addCustomerLedgerEntryService = async (data) => {
  const client = await pool.connect();
  const amount = Number(data.amount);

  try {
    await client.query("BEGIN");

    const balance_before = await getLastCustomerBalance(data.customer_unique_code, client);
    const balance_after =
      data.transaction_type === "YOU_GAVE"
        ? balance_before + amount
        : balance_before - amount;

    const entry = await addCustomerLedgerEntry({
      business_unique_code: data.business_unique_code,
      customer_unique_code: data.customer_unique_code,
      user_unique_code: data.user_unique_code,
      transaction_type: data.transaction_type,
      transaction_source: "MANUAL",
      payment_mode: data.payment_mode,
      amount,
      balance_before,
      balance_after,
      note: data.note ?? null,
      reference_bill_code: null,
      created_by: data.created_by
    }, client);

    await client.query("COMMIT");
    return entry;

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};


export const getCustomerDetailsService = async (customer_unique_code, business_unique_code) => {
  if (!customer_unique_code) throw new Error("Customer code missing");
  if (!business_unique_code) throw new Error("Business code missing");

  const data = await getCustomerDetails(customer_unique_code, business_unique_code);
  if (!data) return null;

  const gave = Number(data.summary?.you_gave || 0);
  const got = Number(data.summary?.you_got || 0);
  const diff = gave - got;

  const final_status = diff > 0 ? "GET" : diff < 0 ? "GIVE" : "CLEAR";
  const final_amount = Math.abs(diff);

  return {
    customer: data.customer,
    final: { status: final_status, amount: final_amount },
    entries: (data.entries || []).map(e => ({
      ledger_unique_code: e.ledger_unique_code,
      datetime: e.entry_datetime,
      balance: Number(e.balance_after),
      you_gave: e.transaction_type === "YOU_GAVE" ? Number(e.amount) : null,
      you_got: e.transaction_type === "YOU_GOT" ? Number(e.amount) : null,
      tag: e.transaction_source
    }))
  };
};
