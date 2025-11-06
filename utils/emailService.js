require("dotenv").config();
const nodemailer = require("nodemailer");

// ✅ Use Brevo SMTP
const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com", // Brevo SMTP host
  port: 587, // Brevo SMTP port
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER,     // e.g. 9a0ae3001@smtp-brevo.com
    pass: process.env.EMAIL_PASSWORD, // e.g. xsmtpsib-xxxxxx...
  },
  logger: true,
  debug: true,
});

/**
 * Sends employee credentials to their email.
 * @param {string} toEmail - The employee's email address.
 * @param {string} password - The plain password (not hashed).
 */
async function sendEmployeeCredentials(toEmail, password) {
  if (!toEmail) {
    console.error("❌ No recipient email provided. Skipping email send.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error(`❌ Invalid email address: ${toEmail}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject: "Your Employee Account Credentials",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Welcome to <span style="color:#0078d7;">Pumo Technovation</span>!</h2>
        <p>Your employee account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${toEmail}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>You can log in here: 
          <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
        </p>
        <p style="color:red;">Please change your password after your first login.</p>
        <br/>
        <p>Best regards,<br/><strong>Pumo Technovation HR Team</strong></p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${toEmail}: ${info.response}`);
  } catch (error) {
    console.error("❌ Email send error:", error);
  }
}

module.exports = { sendEmployeeCredentials };
