require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // use TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendTestMail() {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: "hariharry825@gmail.com", // 👈 replace with your Gmail address
      subject: "Brevo SMTP Test",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>✅ Brevo SMTP Test Successful!</h2>
          <p>If you received this email, your SMTP setup is working fine 🎉</p>
          <p>Sent from <b>${process.env.EMAIL_FROM}</b></p>
        </div>
      `,
    });

    console.log("✅ Email sent successfully:", info.response);
  } catch (err) {
    console.error("❌ Failed to send email:", err);
  }
}

sendTestMail();
