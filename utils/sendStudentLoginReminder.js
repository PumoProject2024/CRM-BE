require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendStudentLoginReminder(toEmail, studentId) {

  if (!toEmail) return;

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  const msg = {
    to: toEmail,
    from: EMAIL_SENDER,
    subject: "You Can See Placement Opportunities in This Portal",
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
        
        <h2 style="color:#0078d7;">Pumo Technovation</h2>

        <p>Hello Student,</p>

        <p>
        You can check your <strong>placement opportunities</strong> and updates through our student portal.
        Our records show that you have not logged in recently.
        </p>

        <p><strong>Your Login Details:</strong></p>

        <ul>
          <li><strong>Email:</strong> ${toEmail}</li>
          <li><strong>Password:</strong> ${studentId}</li>
        </ul>

        <p>
        Login here:<br/>
        <a href="${frontendUrl}" target="_blank">${frontendUrl}</a>
        </p>

        <p style="color:red;">
        Please change your password after your first login.
        </p>

        <hr/>

        <p>
        <strong>Note:</strong><br/>
        If you face any issues related to login credentials, please contact:
        <br/>
        <strong>Mr. Hari - 9025680801</strong>
        </p>

        <p>
        If you have already logged in before and forgot your password, don't worry.
        Click <strong>"Forgot Password"</strong> on the login page, enter your registered email,
        and you will receive a password reset link to create a new password.
        </p>

        <br/>

        <p>
        Regards,<br/>
        <strong>Pumo Technovation Team</strong>
        </p>

      </div>
    `,
  };

  return sgMail.send(msg);
}

module.exports = { sendStudentLoginReminder };