import pool from "../config/dbConnection.js";

const createOrdertable = `
CREATE TABLE IF NOT EXISTS ekbill.orders (
order_id SERIAL PRIMARY KEY,
order_unique_code VARCHAR(50) UNIQUE NOT NULL,
business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
customer_unique_code VARCHAR(50) REFERENCES ekbill.customers(customer_unique_code) ON DELETE SET NULL,
customer_name VARCHAR(255),
customer_phone VARCHAR(20),
country_code VARCHAR(10),
address TEXT,
order_total NUMERIC(12,2) NOT NULL,
order_date TIMESTAMP NOT NULL DEFAULT NOW(),
order_status VARCHAR(20) NOT NULL DEFAULT 'PLACED',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

const createOrderItemsTable = `
CREATE TABLE IF NOT EXISTS ekbill.order_items (
order_item_id SERIAL PRIMARY KEY,
order_item_unique_code VARCHAR(50) UNIQUE NOT NULL,
order_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.orders(order_unique_code) ON DELETE CASCADE,
product_unique_code VARCHAR(50) REFERENCES ekbill.products(product_unique_code) ON DELETE SET NULL, 
product_name VARCHAR(255) NOT NULL,
quantity INTEGER NOT NULL,
selling_price NUMERIC(12,2) NOT NULL,
is_gst_inclusive BOOLEAN DEFAULT FALSE,
gst_percentage NUMERIC(5,2) DEFAULT 0,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;


(async () => {
    try {
        await pool.query(createOrdertable);
        await pool.query(createOrderItemsTable);
        console.log("Order tables created or already exist.");
    } 
    catch (error) {
    console.error("Error creating product database tables:", error);
  }
})();