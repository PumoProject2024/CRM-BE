require("dotenv").config();
const nodemailer = require("nodemailer");

// 📨 Brevo SMTP transporter
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com", // Brevo SMTP server
  port: 587,
  secure: false, // use TLS
  auth: {
    user: process.env.EMAIL_USER,       // e.g. your Brevo login email
    pass: process.env.EMAIL_PASSWORD,   // your Brevo SMTP key
  },
});

/**
 * Sends student login credentials to their email.
 * @param {string} toEmail - The student's email address.
 * @param {string} studentId - The student's ID (used as password).
 */
async function sendStudentCredentials(toEmail, studentId) {
  if (!toEmail) {
    console.error("❌ No recipient email provided. Skipping email send.");
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error(`❌ Invalid email address: ${toEmail}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const mailOptions = {
    from: process.env.EMAIL_FROM || "noreply@pumotechnovationcrm.com", // ✅ Verified domain sender
    to: toEmail,
    subject: "Your Student Account Credentials - Pumo Technovation",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color:#0078d7;">Welcome to Pumo Technovation!</h2>
        <p>Your student account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${toEmail}</li>
          <li><strong>Password:</strong> ${studentId}</li>
        </ul>
        <p>You can log in here:
          <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
        </p>
        <p style="color:red;">Please change your password after your first login.</p>
        <br/>
        <p>Best regards,<br/><strong>Pumo Technovation Team</strong></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Student email sent to ${toEmail}: ${info.response}`);
  } catch (error) {
    console.error("❌ Email send error:", error.message);
  }
}

module.exports = { sendStudentCredentials };
