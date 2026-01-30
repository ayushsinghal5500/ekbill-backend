import {
  createCustomerService,
  getMinimalCustomerListService,
  updateCustomerService,
  deleteCustomerService,
  updateCollectionReminderDateService,
  addCustomerLedgerEntryService,
  getCustomerDetailsService
} from "../service/customerService.js";
import { validatePhone } from "../utils/phone.js";

export const createCustomerController = async (req, res) => {
  try {
    let {
      customer_name,
      phone,
      country_code,
      gender,
      dob,
      anniversary,
      gstin,
      notes,
      address,
      full_address,
      flat_no,
      area,
      pincode,
      city,
      state
    } = req.body;

    // Clean and validate mandatory inputs
    customer_name = customer_name?.toString().trim();
    phone = phone?.toString().trim();
    country_code = country_code?.toString().trim();

    // Validate mandatory fields
    if (!customer_name) {
      return res.status(400).json({
        success: false,
        message: "customer_name is required"
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "phone is required"
      });
    }

    if (!country_code) {
      return res.status(400).json({
        success: false,
        message: "country_code is required"
      });
    }

    // Validate phone number
    const validatedPhone = validatePhone(phone, country_code);
    if (!validatedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    const { business_unique_code, user_unique_code } = req.user;

    if (!business_unique_code || !user_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    // Clean optional inputs
    gstin = gstin?.toString().trim() || null;
    notes = notes?.toString().trim() || null;
    gender = gender?.toString().trim() || null;

    // Handle address - merge all possible formats
    let finalAddress = null;
    if (address || full_address || flat_no || area || city || state || pincode) {
      finalAddress = {
        full_address: full_address?.toString().trim() || address?.toString().trim() || null,
        flat_no: flat_no?.toString().trim() || null,
        area: area?.toString().trim() || null,
        pincode: pincode?.toString().trim() || null,
        city: city?.toString().trim() || null,
        state: state?.toString().trim() || null
      };
    }

    const result = await createCustomerService({
      business_unique_code,
      user_unique_code,
      customer_name,
      phone: validatedPhone,
      country_code,
      gender,
      dob: dob || null,
      anniversary: anniversary || null,
      gstin,
      notes,
      address: finalAddress
    });

    return res.status(result.exists ? 200 : 201).json(result);
  } catch (error) {
    console.error("createCustomerController error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create customer"
    });
  }
};

export const updateCustomerController = async (req, res) => {
  try {
    const { business_unique_code, user_unique_code } = req.user;
    const { customer_unique_code } = req.params;

    if (!customer_unique_code) {
      return res.status(400).json({
        success: false,
        message: "customer_unique_code is required"
      });
    }

    if (!business_unique_code || !user_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    let {
      customer_name,
      phone,
      country_code,
      gender,
      dob,
      anniversary,
      gstin,
      notes,
      address,
      full_address,
      flat_no,
      area,
      pincode,
      city,
      state
    } = req.body;

    // Clean and validate mandatory inputs
    customer_name = customer_name?.toString().trim();
    phone = phone?.toString().trim();
    country_code = country_code?.toString().trim();

    // Validate mandatory fields
    if (!customer_name) {
      return res.status(400).json({
        success: false,
        message: "customer_name is required"
      });
    }

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "phone is required"
      });
    }

    if (!country_code) {
      return res.status(400).json({
        success: false,
        message: "country_code is required"
      });
    }

    // Validate phone number
    const validatedPhone = validatePhone(phone, country_code);
    if (!validatedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format"
      });
    }

    // Clean optional inputs
    gstin = gstin?.toString().trim() || null;
    notes = notes?.toString().trim() || null;
    gender = gender?.toString().trim() || null;

    // Handle address - merge all possible formats
    let finalAddress = null;
    if (address || full_address || flat_no || area || city || state || pincode) {
      finalAddress = {
        full_address: full_address?.toString().trim() || address?.toString().trim() || null,
        flat_no: flat_no?.toString().trim() || null,
        area: area?.toString().trim() || null,
        pincode: pincode?.toString().trim() || null,
        city: city?.toString().trim() || null,
        state: state?.toString().trim() || null
      };
    }

    const result = await updateCustomerService({
      business_unique_code,
      user_unique_code,
      customer_unique_code,
      customer_name,
      phone: validatedPhone,
      country_code,
      gender,
      dob: dob || null,
      anniversary: anniversary || null,
      gstin,
      notes,
      address: finalAddress
    });

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: result
    });
  } catch (error) {
    console.error("updateCustomerController error:", error);
    
    // Handle specific errors
    if (error.message.includes("already exists with this phone number")) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update customer"
    });
  }
};

export const getMinimalCustomerListController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;

    if (!business_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    const customers = await getMinimalCustomerListService(business_unique_code);
    
    return res.status(200).json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    console.error("getMinimalCustomerListController error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer list"
    });
  }
};

export const deleteCustomerController = async (req, res) => {
  try {
    const { business_unique_code, user_unique_code } = req.user;
    const { customer_unique_code } = req.params;

    if (!customer_unique_code) {
      return res.status(400).json({
        success: false,
        message: "customer_unique_code is required"
      });
    }

    if (!business_unique_code || !user_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    const deletedCustomer = await deleteCustomerService(
      business_unique_code,
      user_unique_code,
      customer_unique_code
    );

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
      data: deletedCustomer
    });
  } catch (error) {
    console.error("deleteCustomerController error:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete customer"
    });
  }
};

export const updateCollectionReminderController = async (req, res) => {
  try {
    const { customer_unique_code } = req.params;
    const { collection_reminder_date } = req.body;

    if (!customer_unique_code) {
      return res.status(400).json({
        success: false,
        message: "customer_unique_code is required"
      });
    }

    const result = await updateCollectionReminderDateService(
      customer_unique_code,
      collection_reminder_date
    );

    return res.status(200).json({
      success: true,
      message: "Collection reminder date updated successfully",
      data: result
    });
  } catch (error) {
    console.error("updateCollectionReminderController error:", error);
    
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update collection reminder"
    });
  }
};

export const addCustomerLedgerEntryController = async (req, res) => {
  try {
    const { business_unique_code, user_unique_code } = req.user;
    let { customer_unique_code, transaction_type, payment_mode, amount, note } = req.body;

    if (!business_unique_code || !user_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    if (!customer_unique_code) {
      return res.status(400).json({
        success: false,
        message: "customer_unique_code is required"
      });
    }

    if (!transaction_type) {
      return res.status(400).json({
        success: false,
        message: "transaction_type is required"
      });
    }

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "amount is required"
      });
    }

    if (!payment_mode) {
      return res.status(400).json({
        success: false,
        message: "payment_mode is required"
      });
    }

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number"
      });
    }

    if (!["YOU_GAVE", "YOU_GOT"].includes(transaction_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type. Must be YOU_GAVE or YOU_GOT"
      });
    }

    if (!["CASH", "UPI", "CARD", "BANK", "CHEQUE", "OTHER"].includes(payment_mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment mode. Must be CASH, UPI, CARD, BANK, CHEQUE, or OTHER"
      });
    }

    const entry = await addCustomerLedgerEntryService({
      business_unique_code,
      customer_unique_code,
      user_unique_code,
      transaction_type,
      payment_mode,
      amount,
      note: note?.toString().trim() || "Manual ledger entry",
      reference_bill_code: null,
      created_by: user_unique_code
    });

    return res.status(201).json({
      success: true,
      message: "Ledger entry added successfully",
      data: entry
    });
  } catch (error) {
    console.error("addCustomerLedgerEntryController error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add ledger entry"
    });
  }
};

export const getCustomerDetailController = async (req, res) => {
  try {
    const { customer_unique_code } = req.params;
    const { business_unique_code } = req.user;

    if (!customer_unique_code) {
      return res.status(400).json({
        success: false,
        message: "customer_unique_code is required"
      });
    }

    if (!business_unique_code) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - Invalid user session"
      });
    }

    const result = await getCustomerDetailsService(
      customer_unique_code,
      business_unique_code
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("getCustomerDetailController error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch customer details"
    });
  }
};