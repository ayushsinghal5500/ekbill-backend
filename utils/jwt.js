import jwt from 'jsonwebtoken';
export const generateSessionToken = (business_unique_code) => jwt.sign({ business_unique_code }, process.env.JWT_SECRET, { expiresIn: '7d' });
