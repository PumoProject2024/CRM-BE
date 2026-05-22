require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends student login credentials to their email.
 * @param {string} toEmail - The student's email address.
 * @param {string} studentId - The student's ID (used as password).
 */
async function sendStudentCredentials(toEmail, studentId) {
  console.log("Using FROM email:", process.env.EMAIL_FROM);

  if (!toEmail) {
    console.error("❌ No recipient email provided.");
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error(`❌ Invalid email address: ${toEmail}`);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const msg = {
    to: toEmail,
    from: EMAIL_SENDER,
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
        <p>
          You can log in here:
          <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
        </p>
        <p style="color:red;">
          Please change your password after your first login.
        </p>
        <br/>
        <p>Best regards,<br/><strong>Pumo Technovation Team</strong></p>
      </div>
    `,
  };

  try {
    const response = await sgMail.send(msg);

    console.log("✅ SendGrid student email sent to:", toEmail);
    console.log("📨 SendGrid Status Code:", response[0].statusCode);
    console.log("📨 SendGrid Headers:", response[0].headers);

  } catch (error) {
    console.error("❌ SendGrid Error:");
    console.error("Status Code:", error.code);
    console.error("Response Body:", error.response?.body);
    console.error("Message:", error.message);
  }

}

module.exports = { sendStudentCredentials };
