import pool from "../config/dbConnection.js";

const createNotificationsTable = `
CREATE TABLE IF NOT EXISTS ekbill.notifications (
    id SERIAL PRIMARY KEY,
    notification_unique_code VARCHAR(50) NOT NULL UNIQUE,
    business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
    recipient_user_code VARCHAR(50) REFERENCES ekbill.users(user_unique_code) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('NOTIFICATION','ALERT')),
    module VARCHAR(50),
    reference_code VARCHAR(50),
    actor_type VARCHAR(30),
    actor_code VARCHAR(50),
    action VARCHAR(50),
    action_request_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','HIDDEN')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITHOUT TIME ZONE,
    hidden_at TIMESTAMP WITHOUT TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_notifications_business_status ON ekbill.notifications(business_unique_code,status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON ekbill.notifications(recipient_user_code,is_read);
`;

const createActionRequestsTable = `
CREATE TABLE IF NOT EXISTS ekbill.action_requests (
    id SERIAL PRIMARY KEY,
    request_unique_code VARCHAR(50) NOT NULL UNIQUE,
    business_unique_code VARCHAR(50) NOT NULL REFERENCES ekbill.business_profiles(business_unique_code) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL,
    reference_code VARCHAR(50) NOT NULL,
    requested_by_type VARCHAR(30) NOT NULL,
    requested_by_code VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REJECTED')),
    decided_by VARCHAR(50),
    decided_at TIMESTAMP WITHOUT TIME ZONE,
    decision_reason TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_requests_business_status ON ekbill.action_requests(business_unique_code,status);
CREATE INDEX IF NOT EXISTS idx_action_requests_reference ON ekbill.action_requests(module,reference_code);
`;

(async () => {
    try {
        await pool.query(createNotificationsTable);
        await pool.query(createActionRequestsTable);
        console.log("Business-scoped Notification and Action Request tables ready.");
    } catch (error) {
        console.error("Error creating tables:", error);
    }
    process.exit(0);
})();
