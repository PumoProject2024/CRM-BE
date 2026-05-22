require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const STATUS_CONFIG = {
  Assigned: { emoji: "🎯", color: "#0A66C2", message: "You have been assigned to an interview opportunity." },
  Acknowledged: { emoji: "✅", color: "#16a34a", message: "Your application has been acknowledged by the placement team." },
  Shortlisted: { emoji: "⭐", color: "#7c3aed", message: "Great news! You have been shortlisted for the next round." },
  "Resume Not Shortlisted": { emoji: "📄", color: "#dc2626", message: "Your profile was reviewed, but your resume was not shortlisted for the next round. Keep applying for upcoming opportunities." },
  "Interview Scheduled": { emoji: "🧑‍💼", color: "#0A66C2", message: "Your interview has been scheduled. Please be prepared and check the portal for details." },
  Selected: { emoji: "🏆", color: "#16a34a", message: "Congratulations! You have been selected for this opportunity!" },
  "Not Selected": { emoji: "📩", color: "#dc2626", message: "Thank you for your effort. Unfortunately, you were not selected this time. Keep going!" },
  Cancelled: { emoji: "❌", color: "#dc2626", message: "This opportunity has been cancelled. Please check the portal for other openings." },
  "Rejected By Student": { emoji: "↩️", color: "#d97706", message: "You have rejected this opportunity. Please contact your coordinator if this was a mistake." },
  "Rejected the Offer": { emoji: "↩️", color: "#d97706", message: "You have rejected the offer. Please contact your coordinator if this was a mistake." },
  "Not Attended": { emoji: "⚠️", color: "#dc2626", message: "You were marked as not attended for this interview. Please contact your coordinator." },
};

/**
 * Send status update email to student
 * @param {string} toEmail
 * @param {string} studentId
 * @param {string} companyName
 * @param {string} status
 * @param {string|null} feedback
 */
async function sendStatusUpdateEmail(
  toEmail,
  studentId,
  companyName,
  status,
  feedback = null
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
  const { emoji, color, message } = STATUS_CONFIG[status] || {
    emoji: "🔔",
    color: "#0A66C2",
    message: "Your application status has been updated.",
  };

  const msg = {
    to: toEmail,
    from: EMAIL_SENDER,
    subject: `${emoji} Status Update: ${status} — ${companyName} | Pumo Technovation`,

    html: `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:10px;
          box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:#0A66C2;padding:18px;text-align:center;">
              <img
                src="${frontendUrl}/images/logo.png"
                alt="Pumo Technovation"
                width="140"
                style="display:block;margin:auto;"
              />
            </td>
          </tr>

          <!-- STATUS BANNER -->
          <tr>
            <td style="background:${color};padding:14px 30px;text-align:center;">
              <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                ${emoji} ${status}
              </span>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:30px;color:#333;">

              <p style="margin-top:0;">Hello Student,</p>

              <p>${message}</p>

              <!-- DETAILS TABLE -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="margin:20px 0;border-collapse:collapse;font-size:14px;">
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;width:35%;">
                    Company
                  </td>
                  <td style="padding:10px 14px;border:1px solid #e2e8f0;font-weight:bold;color:#0A66C2;">
                    ${companyName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">
                    Status
                  </td>
                  <td style="padding:10px 14px;border:1px solid #e2e8f0;">
                    <span style="
                      display:inline-block;
                      background:${color}1a;
                      color:${color};
                      padding:3px 10px;
                      border-radius:20px;
                      font-weight:bold;
                      font-size:13px;">
                      ${emoji} ${status}
                    </span>
                  </td>
                </tr>
                ${feedback
        ? `
                <tr style="background:#f1f5f9;">
                  <td style="padding:10px 14px;font-weight:bold;border:1px solid #e2e8f0;">
                    Remarks
                  </td>
                  <td style="padding:10px 14px;border:1px solid #e2e8f0;color:#555;">
                    ${feedback}
                  </td>
                </tr>`
        : ""
      }
              </table>

              <!-- CTA -->
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
                  View on Portal
                </a>
              </div>

              <p style="
                margin-top:20px;
                padding:12px;
                background:#eef4ff;
                border-left:4px solid #0A66C2;
                font-size:14px;">
                📌 Keep checking the portal regularly for updates on your application.
              </p>

              <p style="margin-top:30px;">
                Regards,<br>
                <strong>Pumo Technovation Placement Team</strong>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="
              background:#f1f5f9;
              padding:15px;
              text-align:center;
              font-size:12px;
              color:#666;">
              © ${new Date().getFullYear()} Pumo Technovation &nbsp;|&nbsp; This is an automated message, please do not reply.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</div>
`,
  };

  try {
    const response = await sgMail.send(msg);
    console.log(`✅ Status update email sent to ${toEmail}:`, response[0].statusCode);
  } catch (error) {
    console.error("❌ SendGrid Error (sendStatusUpdateEmail):", error.response?.body || error.message);
  }
}

module.exports = { sendStatusUpdateEmail };