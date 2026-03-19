import nodemailer from 'nodemailer';
import config from '../../config/env.config.js';

class EmailAdapter {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465, 
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  async sendAuthOTP(to, otp, purpose) {
    const mailOptions = {
      from: `"ASTU Eats Security" <${config.EMAIL_FROM}>`,
      to,
      subject: `Your ASTU Eats OTP - ${purpose}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
          <h2>ASTU Eats Identity Verification</h2>
          <p>You requested an OTP for: <strong>${purpose}</strong></p>
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; color: #4CAF50;">
            ${otp}
          </div>
          <p>This code will expire in 15 minutes. Do not share it with anyone.</p>
        </div>
      `,
    };

    if (config.NODE_ENV === 'test') {
      return; // Do not send real emails during jest tests
    }

    await this.transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log(error);
  }
  console.log('Message sent: %s', info.messageId);
});
  }
}

export const emailAdapter = new EmailAdapter();