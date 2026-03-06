const nodemailer = require('nodemailer');

// Create email transporter for real emails (Gmail)
const createEmailTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    }
  });
};

// Email OTP Store
const emailOtpStore = new Map();

// Send OTP via Email (Real Email)
const sendEmailOtp = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiryTime = Date.now() + 10 * 60 * 1000;

  emailOtpStore.set(email, { code: otp, expiresAt: expiryTime });

  try {
    const transporter = createEmailTransporter();
    // If SMTP credentials are not configured, keep OTP flow functional for local/dev usage
    if (!transporter) {
      return otp;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER || 'vcmsdemo.project@gmail.com',
      to: email,
      subject: '🔐 MediConnect - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="margin: 0;">MediConnect Virtual Healthcare</h2>
            <p style="margin: 5px 0 0;">Password Reset Request</p>
          </div>
          <div style="padding: 20px; background: #f0f9ff; border: 1px solid #bae6fd; border-top: 0; border-radius: 0 0 8px 8px;">
            <p>Hello,</p>
            <p>You requested to reset your password. Your OTP code is:</p>
            <div style="background: white; border: 3px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 8px; text-align: center;">
              <h1 style="color: #0284c7; letter-spacing: 5px; font-size: 36px; margin: 0;">${otp}</h1>
            </div>
            <p style="color: #0f172a;"><strong>⏱️ Valid for:</strong> 10 minutes</p>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `
    });
    // OTP sent successfully to email
    return otp;
  } catch (error) {
    // Keep OTP usable even when SMTP provider rejects sending
    return otp;
  }
};

// Verify Email OTP
const verifyEmailOtp = (email, code) => {
  const storedOtp = emailOtpStore.get(email);

  if (!storedOtp) {
    return { success: false, message: 'OTP not found' };
  }

  if (Date.now() > storedOtp.expiresAt) {
    emailOtpStore.delete(email);
    return { success: false, message: 'OTP expired' };
  }

  if (storedOtp.code !== code.toString()) {
    return { success: false, message: 'Invalid OTP' };
  }

  storedOtp.verified = true;
  storedOtp.expiresAt = Date.now() + 5 * 60 * 1000;

  return { success: true, message: 'OTP verified' };
};

// Clear Email OTP
const clearEmailOtp = (email) => {
  emailOtpStore.delete(email);
};

module.exports = {
  emailOtpStore,
  sendEmailOtp,
  verifyEmailOtp,
  clearEmailOtp
};
