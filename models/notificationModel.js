import pool from "../config/dbConnection.js";
import { generateUniqueCode } from "../utils/codeGenerator.js";

export const createNotification = async (data, client = pool) => {
  const { business_unique_code, recipient_user_code, title, message, type, module, reference_code, actor_type, actor_code, action, action_request_code } = data;
  const notification_unique_code = generateUniqueCode("NOTIF");

  await client.query(
    `INSERT INTO ekbill.notifications (notification_unique_code,business_unique_code,recipient_user_code,title,message,type,module,reference_code,actor_type,actor_code,action,action_request_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [notification_unique_code,business_unique_code,recipient_user_code || null,title,message,type,module || null,reference_code || null,actor_type || null,actor_code || null,action || null,action_request_code || null]
  );
};
