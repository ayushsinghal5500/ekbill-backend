import crypto from "crypto";

export const generateUniqueCode = (opts = {}) => {
  let prefix = "GEN";

  if (typeof opts === "string") {
    prefix = opts;
  } else if (opts && typeof opts === "object") {
    prefix = opts.table || prefix;
  }

  prefix = String(prefix).toUpperCase().replace(/\s+/g, "");

  // High-entropy parts
  const part1 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars
  const part2 = crypto.randomBytes(2).toString("base64url").toUpperCase(); // 3–4 chars
  const part3 = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars

  // FINAL PATTERN:
  // PREFIX-PART1-PART2-PART3
  return `${prefix}-${part1}-${part2}-${part3}`;
};
