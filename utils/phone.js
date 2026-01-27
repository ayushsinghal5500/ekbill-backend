import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const validatePhone = (phone, country_code) => {
  try {
    const fullNumber = `${country_code}${phone}`;
    const phoneNumber = parsePhoneNumberFromString(fullNumber);
    if (!phoneNumber || !phoneNumber.isValid()) return false;
    return phoneNumber.number;
  } catch {
    return false;
  }
};
