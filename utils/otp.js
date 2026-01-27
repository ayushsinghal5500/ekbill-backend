import otpGenerator from 'otp-generator';

export const generateOTP = (useDefault = true) => useDefault ? '000000' : otpGenerator.generate(6, { upperCase: false, specialChars: false, alphabets: false, digits: true });

export const otpExpiresAt = () => new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry
