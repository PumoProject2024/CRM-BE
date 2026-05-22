require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } =
  require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmployeeCredentials = async (toEmail, password) => {
  if (!toEmail) {
    console.error("❌ No recipient email provided.");
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL;

  const msg = {
    to: toEmail,
    from: EMAIL_SENDER,
    subject: "Your Employee Account Credentials",
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Welcome to Pumo Technovation!</h2>
        <p>Your employee account has been created successfully.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li><strong>Email:</strong> ${toEmail}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
        <p>
          Login here:
          <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
        </p>
        <p style="color:red;">
          Please change your password after first login.
        </p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ SendGrid email sent to ${toEmail}`);
  } catch (error) {
    console.error("❌ SendGrid Error:", error.response?.body || error.message);
  }
};

module.exports = { sendEmployeeCredentials };
