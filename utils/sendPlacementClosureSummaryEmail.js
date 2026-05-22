require("dotenv").config();

const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlacementClosureSummaryEmail(
  recipients,
  data
) {

  if (!recipients || recipients.length === 0) {
    return;
  }

  let statusCountsHtml = "";

  Object.entries(data.summary.statusCounts)
    .forEach(([status, count]) => {

      statusCountsHtml += `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            ${status}
          </td>

          <td style="padding:8px;border:1px solid #ddd;">
            ${count}
          </td>
        </tr>
      `;
    });

  let studentsHtml = "";

  data.summary.students.forEach(student => {

    studentsHtml += `
      <tr>

        <td style="padding:8px;border:1px solid #ddd;">
          ${student.studentName}
        </td>

        <td style="padding:8px;border:1px solid #ddd;">
          ${student.branch}
        </td>

        <td style="padding:8px;border:1px solid #ddd;">
          ${student.currentStatus}
        </td>

      </tr>
    `;
  });

  await Promise.allSettled(

    recipients.map(user =>
      sgMail.send({

        to: user.email,

        from: EMAIL_SENDER,

        subject:
          `${data.jobReqStatus} - ${data.jobTitle}`,

        html: `

        <div style="font-family:Arial;padding:20px;">

          <h2>
            Job Requirement ${data.jobReqStatus}
          </h2>

          <p>
            <strong>Job ID:</strong>
            ${data.jobReqId}
          </p>

          <p>
            <strong>Company:</strong>
            ${data.companyName}
          </p>

          <p>
            <strong>Job Title:</strong>
            ${data.jobTitle}
          </p>

           <div style="
  background:#f3f4f6;
  padding:15px;
  border-radius:8px;
  margin-top:20px;
  margin-bottom:20px;
">

  <p>
    <strong>Closure Feedback:</strong>
  </p>

  <p>
    ${data.feedbackForClosure}
  </p>

</div>

          <h3>Status Summary</h3>

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="border-collapse:collapse;">

            <tr style="background:#0A66C2;color:white;">

              <th style="padding:10px;border:1px solid #ddd;">
                Status
              </th>

              <th style="padding:10px;border:1px solid #ddd;">
                Count
              </th>

            </tr>

            ${statusCountsHtml}

          </table>

          <br/>

          <h3>Students Summary</h3>

          <table
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="border-collapse:collapse;">

            <tr style="background:#0A66C2;color:white;">

              <th style="padding:10px;border:1px solid #ddd;">
                Student Name
              </th>

              <th style="padding:10px;border:1px solid #ddd;">
                Branch
              </th>

              <th style="padding:10px;border:1px solid #ddd;">
                Status
              </th>

            </tr>

            ${studentsHtml}

          </table>

        </div>
        `
      })
    )
  );
}

module.exports = {
  sendPlacementClosureSummaryEmail
};