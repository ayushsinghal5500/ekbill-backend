import {createCustomerService , getMinimalCustomerListService, updateCustomerService, deleteCustomerService, updateCollectionReminderDateService, addCustomerLedgerEntryService,getCustomerDetailsService} from "../service/customerService.js";
import {validatePhone} from "../utils/phone.js";

export const createCustomerController = async (req, res) => {
  try {
    let {customer_name, phone,country_code,gender,dob,anniversary,gstin,notes,address,full_address,flat_no,area,pincode, city,state } = req.body;

    // Clean inputs
    customer_name = customer_name?.trim();
    phone = phone?.trim();
    country_code = country_code?.trim();
    gstin = gstin?.trim() || null;
    notes = notes?.trim() || null;

    if (!customer_name || !phone || !country_code) {
      return res.status(400).json({
        success: false,
        message: "customer_name, phone, and country_code are mandatory"
      });
    }

    const validatedPhone = validatePhone(phone, country_code);
    if (!validatedPhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number"
      });
    }

    const { business_unique_code, user_unique_code } = req.user;

    // Merge address formats
    const finalAddress = address || full_address || flat_no || area || city
        ? {full_address: full_address || address || null,flat_no: flat_no || null,area: area || null,pincode: pincode || null, city: city || null,  state: state || null  } : null;

    const result = await createCustomerService({business_unique_code,user_unique_code,customer_name,phone: validatedPhone,country_code,gender: gender || null,dob: dob || null,anniversary: anniversary || null,gstin,notes,address: finalAddress});

    res.status(200).json(result);
  } catch (error) {
    console.error("createCustomerController error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateCustomerController = async (req, res) => {
  try {
    const { business_unique_code, user_unique_code } = req.user;
    const { customer_unique_code } = req.params;
    const { customer_name, phone, country_code } = req.body;

    if (!customer_name || !phone || !country_code)
      return res.status(400).json({ 
    success: false,
     message: "customer_name, phone, and country_code are mandatory" 
    });

    const result = await updateCustomerService({
      business_unique_code,
      user_unique_code,
      customer_unique_code,
      customer_name,
      phone,
      country_code,
      gender: req.body.gender || null,
      dob: req.body.dob || null,
      anniversary: req.body.anniversary || null,
      gstin: req.body.gstin || null,
      notes: req.body.notes || null,
      address: (req.body.full_address || req.body.flat_no || req.body.area || req.body.city)
        ? {
            full_address: req.body.full_address || null,
            flat_no: req.body.flat_no || null,
            area: req.body.area || null,
            pincode: req.body.pincode || null,
            city: req.body.city || null,
            state: req.body.state || null
          }
        : null
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getMinimalCustomerListController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;
    const customers = await getMinimalCustomerListService(business_unique_code);
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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

    const deletedCustomer = await deleteCustomerService(business_unique_code, user_unique_code, customer_unique_code);
    
    res.json({ 
      success: true, 
      message: "Customer deleted successfully",
      data: deletedCustomer 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const result = await updateCollectionReminderDateService(customer_unique_code, collection_reminder_date);
    
    res.json({ 
      success: true, 
      message: "Collection reminder date updated successfully",
      data: result 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addCustomerLedgerEntryController = async (req, res) => {
  try {
    const { business_unique_code, user_unique_code } = req.user;
    let { customer_unique_code, transaction_type, payment_mode, amount, note } = req.body;

    if (!customer_unique_code || !transaction_type || !amount)
      return res.status(400).json({ success: false, message: "customer_unique_code, transaction_type and amount are required" });

    amount = Number(amount);
    if (isNaN(amount) || amount <= 0)
      return res.status(400).json({ success: false, message: "Amount must be a positive number" });

    if (!["YOU_GAVE","YOU_GOT"].includes(transaction_type))
      return res.status(400).json({ success: false, message: "Invalid transaction type" });

    if (!["CASH","UPI","CARD","BANK","CHEQUE","OTHER"].includes(payment_mode))
      return res.status(400).json({ success: false, message: "Invalid payment mode" });

    const entry = await addCustomerLedgerEntryService({
      business_unique_code,
      customer_unique_code,
      user_unique_code,
      transaction_type,
      payment_mode,
      amount,
      note: note || "Manual ledger entry",
      reference_bill_code: null,
      created_by: user_unique_code
    });

    return res.status(201).json({ success: true, message: "Manual ledger entry added", entry });
  } catch (err) {
    console.error("addCustomerLedgerEntryController error:", err);
    return res.status(400).json({ success: false, message: err.message || "Failed to add ledger entry" });
  }
};


export const getCustomerDetailController = async (req, res) => {
  try {
    const { customer_unique_code } = req.params;
    const { business_unique_code } = req.user;

    if (!customer_unique_code)
      return res.status(400).json({ success: false, message: "Customer code is required" });

    const result = await getCustomerDetailsService(customer_unique_code, business_unique_code);

    if (!result)
      return res.status(404).json({ success: false, message: "Customer not found" });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error("Customer detail error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

