require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send placement unmapping email to student
 */
async function sendUnmappingEmail(
  toEmail,
  studentId,
  companyName,
  mappedByName = "Placement Team",
  mappedByPhone = "N/A"
) {

  console.log("Using FROM email:", process.env.EMAIL_FROM);

  if (!toEmail) {
    console.error("❌ No recipient email provided.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(toEmail)) {
    console.error("❌ Invalid email:", toEmail);
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const msg = {
    to: toEmail,
    from: EMAIL_SENDER,
    subject: "Placement Update - Mapping Removed | Pumo Technovation",

    html: `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:10px;
          box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#dc2626;padding:18px;text-align:center;">
              <img 
                src="${frontendUrl}/images/logo.png"
                alt="Pumo Technovation"
                width="140"
                style="display:block;margin:auto;"
              />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px;color:#333;">

              <h2 style="margin-top:0;color:#dc2626;">
                ⚠️ Placement Mapping Removed
              </h2>

              <p>Hello Student,</p>

              <p>
                Your placement mapping with the following company has been removed:
              </p>

              <p style="
                font-size:18px;
                font-weight:bold;
                color:#111;
                background:#fef2f2;
                padding:10px;
                border-radius:6px;
                display:inline-block;">
                ${companyName}
              </p>

              <p style="
                margin-top:15px;
                font-size:14px;
                background:#f8fafc;
                padding:12px;
                border-radius:6px;
                border:1px solid #e5e7eb;
              ">
                <strong>Updated By:</strong><br>
                Name: <span style="font-weight:bold;">
                  ${mappedByName}
                </span><br>
                Contact: <span style="font-weight:bold;color:#0A66C2;">
                  ${mappedByPhone}
                </span>
              </p>

              <p style="margin-top:20px;color:#b91c1c;font-weight:500;">
                This opportunity is no longer active for you. Please check the portal for other opportunities.
              </p>

              <div style="text-align:center;margin:30px 0;">
                <a href="${frontendUrl}/login"
                  style="
                    background:#0A66C2;
                    color:white;
                    padding:14px 28px;
                    text-decoration:none;
                    border-radius:6px;
                    font-weight:bold;
                    font-size:16px;
                    display:inline-block;">
                  Login to Portal
                </a>
              </div>

              <p>
                Stay active and keep your profile updated to receive new placement opportunities.
              </p>

              <p style="
                margin-top:20px;
                padding:12px;
                background:#eef4ff;
                border-left:4px solid #0A66C2;
                font-size:14px;">
                📌 Keep your resume updated for better placement chances.
              </p>

              <p style="margin-top:30px;">
                Regards,<br>
                <strong>Pumo Technovation Placement Team</strong>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              background:#f1f5f9;
              padding:15px;
              text-align:center;
              font-size:12px;
              color:#666;">
              © ${new Date().getFullYear()} Pumo Technovation
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</div>
`
  };

  try {
    const response = await sgMail.send(msg);
    console.log("✅ Unmapping email sent:", response[0].statusCode);
  } catch (error) {
    console.error("❌ SendGrid Error:", error.response?.body || error.message);
  }
}

module.exports = { sendUnmappingEmail };