import { getBusinessCodeFromSlug,findOrCreateCustomerWithAddress,createOrderWithItems} from "../models/oderModel.js";

export const processOrder = async (orderData) => {
  const { store_slug, customer, items, totals } = orderData;
  // 1️⃣ Store → Business
  const businessCode = await getBusinessCodeFromSlug(store_slug);

  // 2️⃣ Customer find or create
  const customerCode = await findOrCreateCustomerWithAddress(businessCode,customer);

  // 3️⃣ Create order + items + notifications
  const orderCode = await createOrderWithItems( businessCode,customerCode, customer,items, totals);

  return {
    success: true,
    message: "Order placed successfully",
    order_unique_code: orderCode
  };
};
