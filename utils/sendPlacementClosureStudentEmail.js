require("dotenv").config();

const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlacementClosureStudentEmail(
  recipients,
  data
) {

  if (!recipients || recipients.length === 0) {
    return;
  }

  await Promise.allSettled(

    recipients.map(student =>
      sgMail.send({

        to: student.email,

        from: EMAIL_SENDER,

        subject:
          `Job Requirement ${data.jobReqStatus}`,

        html: `

        <div style="
          font-family:Arial;
          padding:20px;
        ">

          <h2>
            Job Requirement ${data.jobReqStatus}
          </h2>

          <p>
            Hello ${student.name || "Student"},
          </p>

          <p>
            The job requirement for
            <strong>${data.jobTitle}</strong>
            at
            <strong>${data.companyName}</strong>
            has been
            <strong>${data.jobReqStatus}</strong>.
          </p>

          <p>
            Please login to the portal
            and check your current status.
          </p>

          <br/>

          <p>
            Regards,<br/>
            Placement Team
          </p>

        </div>
        `
      })
    )
  );
}

module.exports = {
  sendPlacementClosureStudentEmail
};