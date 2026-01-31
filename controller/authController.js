import {createSendOtpService, verifyOTPService} from "../service/authService.js";

export const createSendOtpController = async (req, res) => {
    try {
        const { phone, country_code } = req.body;        
        if (!phone || !country_code) {
            return res.status(400).json({ 
                success: false,
                error: 'Phone and country code are required' 
            });
        }        
        
        const result = await createSendOtpService(phone, country_code);        
        
        return res.status(200).json({ 
            success: true,
            message: 'OTP sent successfully',
            data: {
                phone: phone,
                country_code: country_code,
            }
        });
    } catch (error) {
        console.error('Send OTP Error:', error.message);
        return res.status(400).json({ 
            success: false,
            error: error.message || 'Failed to send OTP',
            timestamp: new Date()
        });
    }
};

export const verifyOtpController = async (req, res) => {
    try {
        const { phone, country_code, otp } = req.body;
        
        if (!phone || !country_code || !otp) {
            return res.status(400).json({ 
                success: false,
                error: 'Phone, country code, and OTP are required',
                timestamp: new Date()
            });
        }
        
        const result = await verifyOTPService(phone, country_code, otp);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Verify OTP Error:', error.message);
        return res.status(400).json({ 
            success: false,
            error: error.message || 'Failed to verify OTP',
            timestamp: new Date()
        });
    }
};


export const refreshTokenController = async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({ 
                success: false, 
                error: 'Refresh token is required' 
            });
        }

        const result = await refreshTokenService(refresh_token);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Refresh Token Error:', error.message);
        return res.status(401).json({ 
            success: false, 
            error: error.message || 'Invalid refresh token',
            timestamp: new Date()
        });
    }
};