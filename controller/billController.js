import {createBillService,getBillsListService,getBillDetailsService} from '../service/billService.js';

export const createbillController =async (req,res)=>{
    try{
        const {business_unique_code,user_unique_code}=req.user;
        const billData={...req.body,business_unique_code,user_unique_code};
        const newBill=await createBillService(billData);
        res.status(201).json({success:true,data:newBill});
    }catch(error){
        res.status(500).json({success:false,message:error.message});
    }
};

export const getBillsListController = async (req, res) => {
  try {
    const { business_unique_code } = req.user;

    if (!business_unique_code)
      return res.status(400).json({ success: false, message: "Business not linked to user" });

    const bills = await getBillsListService(business_unique_code);

    return res.status(200).json({ success: true, data: bills });
  } catch (err) {
    console.error("getQuickBillsList error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getBillDetailsController = async (req, res) => {
    try {
        const { bill_unique_code } = req.params;
        const { business_unique_code } = req.user;
        const bill = await getBillDetailsService(bill_unique_code, business_unique_code);
        if (!bill) {
            return res.status(404).json({ success: false, message: "Bill not found" });
        }
        return res.status(200).json({ success: true, data: bill });
    } catch (err) {
        console.error("getBillById error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
};