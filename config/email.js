const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} options.text - Plain text email content
 * @returns {Promise<boolean>} - True if email sent successfully
 */
async function sendEmail({ to, subject, html, text }) {
    try {
        // If email is not configured, log instead of sending
        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.log('📧 Email (not configured, logging instead):');
            console.log('To:', to);
            console.log('Subject:', subject);
            console.log('Content:', text || html);
            return true;
        }

        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"NeighborNet" <noreply@neighbornet.com>',
            to,
            subject,
            text,
            html,
        });

        console.log('✅ Email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email error:', error);
        return false;
    }
}

module.exports = { sendEmail };
