import pool from "../config/dbConnection.js";

const createSchema = `
CREATE SCHEMA IF NOT EXISTS ekbill;
`;

const roleTable = `
CREATE TABLE IF NOT EXISTS ekbill.roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
const permissionTable = `
CREATE TABLE IF NOT EXISTS ekbill.permissions (
  permission_id SERIAL PRIMARY KEY,
  permission_key VARCHAR(100) NOT NULL UNIQUE, -- e.g. CREATE_BILL, VIEW_REPORTS
  module VARCHAR(50) NOT NULL,                 -- BILLING, INVENTORY, STAFF, SETTINGS
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
const rolePermissionsTable = `
CREATE TABLE IF NOT EXISTS ekbill.role_permissions (
  role_permission_id SERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES ekbill.roles(role_id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES ekbill.permissions(permission_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (role_id, permission_id)
);
`;

const adminTable = `
CREATE TABLE IF NOT EXISTS ekbill.admins (
  admin_id SERIAL PRIMARY KEY,
  admin_unique_code VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  role_id INT NOT NULL REFERENCES ekbill.roles(role_id),
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  status VARCHAR(50) DEFAULT 'active',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  updated_by VARCHAR(50),
  UNIQUE (phone, country_code)
);
`;

const adminAuthTable = `
CREATE TABLE IF NOT EXISTS ekbill.admin_auth (
  admin_auth_id SERIAL PRIMARY KEY,
  admin_unique_code VARCHAR(50) NOT NULL UNIQUE REFERENCES ekbill.admins(admin_unique_code) ON DELETE CASCADE,
  otp_hash TEXT,
  otp_expires_at TIMESTAMP,
  resend_count INTEGER DEFAULT 0,
  last_otp_request_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createAdminSessionTable = `
CREATE TABLE IF NOT EXISTS ekbill.admin_sessions (
  admin_session_id SERIAL PRIMARY KEY,
  admin_session_unique_code VARCHAR(50) NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL UNIQUE,
  refresh_expires_at TIMESTAMP NOT NULL,
  admin_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.admins(admin_unique_code) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  forced_logout BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createUserTable = `
CREATE TABLE IF NOT EXISTS ekbill.users (
  user_id SERIAL PRIMARY KEY,
  user_unique_code VARCHAR(50) NOT NULL UNIQUE,
  phone VARCHAR(15) NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(255) UNIQUE,
  status VARCHAR(30) DEFAULT 'active',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (phone, country_code)
);
`;
const businessProfileTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_profiles (
  business_id SERIAL PRIMARY KEY,
  business_unique_code VARCHAR(50) NOT NULL UNIQUE,
  owner_user_unique_code VARCHAR(50) NOT NULL UNIQUE REFERENCES ekbill.users(user_unique_code),
  business_name VARCHAR(150),
  business_type VARCHAR(50),
  business_category VARCHAR(50),
  primary_phone VARCHAR(15) NOT NULL,
  secondary_phone VARCHAR(15),
  primary_email VARCHAR(255),
  status VARCHAR(30) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createUserAuthTable = `
CREATE TABLE IF NOT EXISTS ekbill.user_auth (
  auth_id SERIAL PRIMARY KEY,
  user_unique_code VARCHAR(50) NOT NULL UNIQUE REFERENCES ekbill.users(user_unique_code) ON DELETE CASCADE,
  otp_hash TEXT,
  otp_expires_at TIMESTAMP,
  resend_count INTEGER DEFAULT 0,
  last_otp_request_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  is_locked BOOLEAN DEFAULT FALSE,
  last_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createSessionTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_sessions (
  business_session_id SERIAL PRIMARY KEY,
  business_session_unique_code VARCHAR(50) NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL UNIQUE,
  refresh_expires_at TIMESTAMP NOT NULL,
  user_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.users(user_unique_code) ON DELETE CASCADE,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  forced_logout BOOLEAN DEFAULT FALSE,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const businessStaffTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_staff (
  staff_id SERIAL PRIMARY KEY,
  staff_unique_code VARCHAR(50) NOT NULL UNIQUE,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  user_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.users(user_unique_code) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'active',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_removed BOOLEAN DEFAULT FALSE,
  removed_at TIMESTAMP,
  removed_by VARCHAR(50),
  removal_reason TEXT,
  UNIQUE (business_unique_code, user_unique_code)
);
`;

const businessStaffRolesTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_staff_roles (
  staff_role_id SERIAL PRIMARY KEY,
  staff_unique_code VARCHAR(50) NOT NULL,
  role_name VARCHAR(50) NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (staff_unique_code, role_id)
);
`;
 
const businessAssetsTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_assets (
  asset_id SERIAL PRIMARY KEY,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  asset_type VARCHAR(30) NOT NULL,
  signature_type VARCHAR(20),
  text_value TEXT,
  file_url TEXT,
  mime_type VARCHAR(50),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const businessFinancialsTable = `
CREATE TABLE IF NOT EXISTS ekbill.business_financials (
  financial_id SERIAL PRIMARY KEY,
  business_unique_code VARCHAR(50) NOT NULL unique REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  pan_number VARCHAR(20),
  gstin VARCHAR(20) ,
  bank_name VARCHAR(100) ,
  ifsc_code VARCHAR(20),
  bank_account_number VARCHAR(50),
  upi_id VARCHAR(100) ,
  bank_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_unique_code, gstin),
  UNIQUE (business_unique_code, bank_account_number),
  UNIQUE (business_unique_code, upi_id)
);
`;

const createAddressesTable = `
CREATE TABLE IF NOT EXISTS ekbill.addresses (
  address_id SERIAL PRIMARY KEY,
  address_unique_code VARCHAR(50) NOT NULL UNIQUE,
  address_label VARCHAR(50),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(50),
  updated_by VARCHAR(50)
);
`;

const createAddressEntityTable = `
CREATE TABLE IF NOT EXISTS ekbill.entity_addresses (
  entity_address_id SERIAL PRIMARY KEY,
  address_unique_code varchar(50) NOT NULL REFERENCES ekbill.addresses(address_unique_code) ON DELETE CASCADE,
  entity_unique_code VARCHAR(50) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  address_role VARCHAR(20) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
created_by VARCHAR(50),
updated_by VARCHAR(50)
);
`;

const customerTable = `
CREATE TABLE IF NOT EXISTS ekbill.customers (
  customer_id SERIAL PRIMARY KEY,
  customer_unique_code VARCHAR(50) NOT NULL UNIQUE,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  added_by_user_unique_code VARCHAR(50),
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20),
  customer_country_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted BOOLEAN DEFAULT FALSE,
  UNIQUE (business_unique_code, customer_phone)
);
`;

const customerDetailsTable = `
CREATE TABLE IF NOT EXISTS ekbill.customer_details (
  customer_detail_id SERIAL PRIMARY KEY,
  customer_unique_code VARCHAR(50) NOT NULL UNIQUE REFERENCES ekbill.customers(customer_unique_code) ON DELETE CASCADE,
  gender VARCHAR(20),
  dob DATE,
  anniversary DATE,
  gstin VARCHAR(20),
  notes TEXT,
  collection_reminder_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const  busineesLedgerTable = `
CREATE TABLE IF NOT EXISTS ekbill.customer_ledger (
  ledger_id SERIAL PRIMARY KEY,
  ledger_unique_code VARCHAR(50) NOT NULL UNIQUE,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  customer_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.customers(customer_unique_code) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('YOU_GAVE','YOU_GOT')),
  transaction_source VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (transaction_source IN ('MANUAL','BILL','ADJUSTMENT')),
  payment_mode VARCHAR(20) NOT NULL CHECK (payment_mode IN ('CASH','UPI','CARD','BANK','CHEQUE','OTHER')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  note TEXT,
  reference_bill_code VARCHAR(50),
  created_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code) ON DELETE SET NULL,
  updated_by VARCHAR(50) REFERENCES ekbill.users(user_unique_code) ON DELETE SET NULL,
  entry_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_ledger_business_customer ON ekbill.customer_ledger(business_unique_code,customer_unique_code);
`;

const publicStoresTable = `
CREATE TABLE ekbill.public_stores (
  store_unique_code VARCHAR(50) PRIMARY KEY,
  business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
  public_slug VARCHAR(120) NOT NULL UNIQUE,
  store_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  is_accepting_orders BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const staffProfileTable = `
CREATE TABLE IF NOT EXISTS ekbill.staff_profiles (
  staff_profile_id SERIAL PRIMARY KEY,
  staff_profile_unique_code VARCHAR(50) NOT NULL UNIQUE,
  staff_unique_code VARCHAR(50) NOT NULL UNIQUE REFERENCES ekbill.business_staff(staff_unique_code) ON DELETE CASCADE,
  full_name VARCHAR(150) NOT NULL,
  staff_phone varchar(10),
  country_code varchar(10),
  profile_photo_url TEXT,
  joining_date DATE,
  leaving_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (leaving_date IS NULL OR leaving_date >= joining_date)
);
`;

const staff_attendance_logs =`
CREATE TABLE IF NOT EXISTS ekbill.staff_attendance_logs (
  attendance_log_id SERIAL PRIMARY KEY,
  staff_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_staff(staff_unique_code) ON DELETE CASCADE,
  punch_in_time TIMESTAMP NOT NULL,
  punch_out_time TIMESTAMP,
  log_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const staff_daily_attendance =`
 CREATE TABLE IF NOT EXISTS ekbill.staff_daily_attendance (
  attendance_id SERIAL PRIMARY KEY,
  staff_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_staff(staff_unique_code) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT','ABSENT','LEAVE','HALF_DAY')),
  marked_by VARCHAR(50), -- owner or manager user_unique_code
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (staff_unique_code, attendance_date)
);
`;
(async () => {
  try {
    await pool.query(createSchema);
    await pool.query(roleTable);
    await pool.query(adminTable);
    await pool.query(adminAuthTable);
    await pool.query(createAdminSessionTable);
    await pool.query(createUserTable);
    await pool.query(businessProfileTable);
    await pool.query(createUserAuthTable);
    await pool.query(createSessionTable);
    await pool.query(businessStaffTable);
    await pool.query(businessAssetsTable);
    await pool.query(businessFinancialsTable);
    await pool.query(createAddressesTable);
    await pool.query(createAddressEntityTable);
    await pool.query(customerTable);
    await pool.query(customerDetailsTable);
    await pool.query(businessStaffRolesTable);
    await pool.query(busineesLedgerTable);
    await pool.query(publicStoresTable);
    await pool.query(permissionTable);
    await pool.query(rolePermissionsTable);
    await pool.query(staffProfileTable);
    await pool.query(staff_attendance_logs);
    await pool.query(staff_daily_attendance);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_addresses_lookup
      ON ekbill.entity_addresses (entity_unique_code, entity_type);
    `);

    console.log("✅ All tables created successfully");
  } catch (err) {
    console.error("❌ Error creating tables:", err.message);
  }
})();
