import {createBillService} from '../service/billService.js';

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