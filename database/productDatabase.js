import pool from "../config/dbConnection.js"; 

const createCategoryTable = `
CREATE TABLE IF NOT EXISTS ekbill.categories (
category_id SERIAL PRIMARY KEY,
category_unique_code VARCHAR(50) NOT NULL UNIQUE,
business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
category_name VARCHAR(255) NOT NULL,
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const createMasterProductTable = `
CREATE TABLE IF NOT EXISTS ekbill.products (
product_id SERIAL PRIMARY KEY,
product_unique_code VARCHAR(50) NOT NULL UNIQUE,
business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
category_unique_code VARCHAR(50) REFERENCES ekbill.categories(category_unique_code) ON DELETE SET NULL,
product_name VARCHAR(255) NOT NULL,
barcode VARCHAR(100),
primary_unit VARCHAR(50) NOT NULL DEFAULT 'PCS',
has_secondary_unit BOOLEAN DEFAULT FALSE,
conversion_factor NUMERIC(10,4) DEFAULT 1,
secondary_unit VARCHAR(50),
expiry_date DATE,
expiry_alert_days INT DEFAULT 0,
low_stock_alert INT DEFAULT 0,
is_active BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const  createProductPricingTable = `
CREATE TABLE IF NOT EXISTS ekbill.product_pricing (
pricing_id SERIAL PRIMARY KEY,
product_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.products(product_unique_code) ON DELETE CASCADE,
selling_price NUMERIC(10,2) NOT NULL,
cost_price NUMERIC(10,2) NOT NULL,
tax_applicability VARCHAR(20) NOT NULL,
gst_rate NUMERIC(5,2) DEFAULT 0,
price_includes_tax BOOLEAN NOT NULL DEFAULT FALSE,
tax_structure VARCHAR(20) NOT NULL,
hsn_code VARCHAR(50),
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const creareProductAssetTable = `
CREATE TABLE IF NOT EXISTS ekbill.product_media (
media_id SERIAL PRIMARY KEY,
product_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.products(product_unique_code) ON DELETE CASCADE,
image_url VARCHAR(500),
image_name VARCHAR(255),
image_type VARCHAR(50),
image_size BIGINT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const createProductHistoryTable = `
CREATE TABLE IF NOT EXISTS ekbill.product_stock_history (
stock_history_id SERIAL PRIMARY KEY,
history_unique_code VARCHAR(50) NOT NULL UNIQUE,
product_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.products(product_unique_code) ON DELETE CASCADE,
business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
transaction_type VARCHAR(20) NOT NULL, -- IN / OUT (validate in app)
transaction_source VARCHAR(20) NOT NULL CHECK (transaction_source IN ('BILL','MANUAL','ADJUSTMENT')), 
reference_bill_code VARCHAR(50),
quantity INT NOT NULL,
unit VARCHAR(50) DEFAULT 'PCS',
price NUMERIC(10,2) NOT NULL,
note TEXT,
reference_type VARCHAR(20), -- BILL / PURCHASE / ADJUSTMENT
reference_id VARCHAR(50),
entry_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const createBillTable = `
CREATE TABLE IF NOT EXISTS ekbill.bills (
bill_id SERIAL PRIMARY KEY,
bill_unique_code VARCHAR(50) NOT NULL UNIQUE,
business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
customer_unique_code VARCHAR(50) REFERENCES ekbill.customers(customer_unique_code) ON DELETE SET NULL,
invoice_number VARCHAR(50) NOT NULL,
invoice_date DATE DEFAULT CURRENT_DATE,
due_date DATE DEFAULT CURRENT_DATE,
subtotal NUMERIC(12,2) DEFAULT 0,
tax_total NUMERIC(12,2) DEFAULT 0,
discount_total NUMERIC(12,2) DEFAULT 0,
grand_total NUMERIC(12,2) NOT NULL,
is_discount_applied BOOLEAN DEFAULT FALSE,
discount_type VARCHAR(20),
discount_value NUMERIC(10,2) DEFAULT 0,
notes TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const createBillItemsTable = `
CREATE TABLE IF NOT EXISTS ekbill.bill_items (
item_id SERIAL PRIMARY KEY,
item_unique_code VARCHAR(50) NOT NULL UNIQUE,
bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.bills(bill_unique_code) ON DELETE CASCADE,
product_unique_code VARCHAR(50) REFERENCES ekbill.products(product_unique_code) ON DELETE SET NULL,
product_name VARCHAR(255) NOT NULL,
quantity INT NOT NULL,
unit VARCHAR(50) DEFAULT 'PCS',
selling_price NUMERIC(10,2) NOT NULL,
tax_applicable BOOLEAN DEFAULT FALSE,
gst_rate NUMERIC(5,2) DEFAULT 0,
gst_amount NUMERIC(10,2) DEFAULT 0,
cgst NUMERIC(10,2) DEFAULT 0,
sgst NUMERIC(10,2) DEFAULT 0,
igst NUMERIC(10,2) DEFAULT 0,
line_total NUMERIC(12,2) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const chargesTable = `
CREATE TABLE IF NOT EXISTS ekbill.charges (
charge_id SERIAL PRIMARY KEY,
charge_unique_code VARCHAR(50) NOT NULL UNIQUE,
bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.bills(bill_unique_code) ON DELETE CASCADE,
charge_name VARCHAR(100) NOT NULL,
charge_amount NUMERIC(12,2) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const discountsTable = `
CREATE TABLE IF NOT EXISTS ekbill.discounts (
discount_id SERIAL PRIMARY KEY,
discount_unique_code VARCHAR(50) NOT NULL UNIQUE,
bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.bills(bill_unique_code) ON DELETE CASCADE,
discount_type VARCHAR(20) NOT NULL,
discount_value NUMERIC(10,2) NOT NULL,
discount_amount NUMERIC(12,2) NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const billPaymentTable =`
CREATE TABLE IF NOT EXISTS ekbill.bill_payments (
payment_id SERIAL PRIMARY KEY,
payment_unique_code VARCHAR(50) NOT NULL UNIQUE,
bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.bills(bill_unique_code) ON DELETE CASCADE,
user_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.users(user_unique_code) ON DELETE SET NULL,
customer_unique_code VARCHAR(50) REFERENCES ekbill.customers(customer_unique_code) ON DELETE SET NULL,
payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH','UPI','CARD','BANK','CHEQUE','OTHER')),
amount_paid NUMERIC(12,2) NOT NULL CHECK (amount_paid > 0),
payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code)
);
`;

const quickBillsTable = `
CREATE TABLE ekbill.quick_bills (
  quick_bill_id SERIAL PRIMARY KEY,
  quick_bill_unique_code VARCHAR(50) NOT NULL UNIQUE,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  invoice_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_country_code VARCHAR(10),
  billing_user_phone VARCHAR(20),
  notes TEXT,
  invoice_date DATE DEFAULT CURRENT_DATE,
  due_date DATE DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL,
  has_discount BOOLEAN DEFAULT FALSE,
  has_gst BOOLEAN DEFAULT FALSE,
  discount_type VARCHAR(10) CHECK (discount_type IN ('FLAT','PERCENT')),
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  gst_type VARCHAR(15) CHECK (gst_type IN ('CGST_SGST','IGST')),
  gst_percentage NUMERIC(5,2) DEFAULT 0,
  is_gst_inclusive BOOLEAN DEFAULT FALSE,
  cgst_amount NUMERIC(12,2) DEFAULT 0,
  sgst_amount NUMERIC(12,2) DEFAULT 0,
  igst_amount NUMERIC(12,2) DEFAULT 0,
  total_gst_amount NUMERIC(12,2) DEFAULT 0,
  grand_total NUMERIC(12,2) NOT NULL,
  created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const quicBillItemsTable = `
CREATE TABLE ekbill.quick_bill_items (
  id SERIAL PRIMARY KEY,
  quick_bill_item_unique_code VARCHAR(50) NOT NULL UNIQUE,
  quick_bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.quick_bills(quick_bill_unique_code) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  line_total NUMERIC(12,2) NOT NULL
);
`;

const createQuickBillPaymentsTable = `
CREATE TABLE IF NOT EXISTS ekbill.quick_bill_payments (
  quick_bill_payment_id SERIAL PRIMARY KEY,
  quick_bill_payment_unique_code VARCHAR(50) NOT NULL UNIQUE,
  quick_bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.quick_bills(quick_bill_unique_code) ON DELETE CASCADE,
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH','UPI','CARD','CREDIT')),
  amount NUMERIC(12,2) NOT NULL,
  remaining_due NUMERIC(12,2) DEFAULT 0,
  created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
  updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const quickBillChargesTable = `
CREATE TABLE IF NOT EXISTS ekbill.quick_bill_charges (
 id SERIAL PRIMARY KEY,
  quick_bill_charge_unique_code VARCHAR(50) NOT NULL UNIQUE,
  quick_bill_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.quick_bills(quick_bill_unique_code) ON DELETE CASCADE,
  charge_name VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0)
);
`;

(async () => {
  try {
    await pool.query(createCategoryTable);
    await pool.query(createMasterProductTable);
    await pool.query(createProductPricingTable);
    await pool.query(creareProductAssetTable);
    await pool.query(createProductHistoryTable);
    await pool.query(createBillTable);
    await pool.query(createBillItemsTable);
    await pool.query(chargesTable);
    await pool.query(discountsTable);
    await pool.query(billPaymentTable);
    await pool.query(quickBillsTable);
    await pool.query(quicBillItemsTable);
    await pool.query(createQuickBillPaymentsTable);
    await pool.query(quickBillChargesTable);
    console.log("Product database tables created successfully.");
  } catch (error) {
    console.error("Error creating product database tables:", error);
  }
})();