require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlacementUpdateStudentEmail(
  recipients,
  updateData
) {

  if (!recipients || recipients.length === 0) {
    console.warn("⚠️ No student recipients found");
    return;
  }

  const frontendUrl =
    process.env.FRONTEND_URL || "http://localhost:3000";

  let updatedFieldsHtml = "";

  Object.entries(updateData.updatedFields).forEach(
    ([field, values]) => {

      updatedFieldsHtml += `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">
            <strong>${field}</strong>
          </td>

          <td style="
            padding:8px;
            border:1px solid #ddd;
            color:#b91c1c;
          ">
            ${values.oldValue}
          </td>

          <td style="
            padding:8px;
            border:1px solid #ddd;
            color:#15803d;
          ">
            ${values.newValue}
          </td>
        </tr>
      `;
    }
  );

  const results = await Promise.allSettled(

    recipients.map(student =>
      sgMail.send({

        to: student.email,
        from: EMAIL_SENDER,

        subject:
          `Updated Job Requirement - ${updateData.jobTitle}`,

        html: `
        <div style="
          margin:0;
          padding:0;
          background:#f4f6f8;
          font-family:Arial,sans-serif;
        ">

          <table width="100%"
            cellpadding="0"
            cellspacing="0"
            style="padding:20px;">

            <tr>
              <td align="center">

                <table width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  style="
                    max-width:700px;
                    background:#ffffff;
                    border-radius:10px;
                    overflow:hidden;
                  ">

                  <tr>
                    <td style="
                      background:#0A66C2;
                      padding:18px;
                      text-align:center;
                    ">
                      <h2 style="color:#fff;margin:0;">
                        Job Requirement Updated
                      </h2>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px;color:#000;">

                      <p>
                        Hello ${student.name || "Student"},
                      </p>

                      <p>
                        A job requirement mapped to you
                        has been updated.
                      </p>

                      <div style="
                        background:#f3f4f6;
                        padding:15px;
                        border-radius:8px;
                        margin-bottom:20px;
                      ">

                        <p>
                          <strong>Job ID:</strong>
                          ${updateData.jobReqId}
                        </p>

                        <p>
                          <strong>Company:</strong>
                          ${updateData.companyName}
                        </p>

                        <p>
                          <strong>Job Title:</strong>
                          ${updateData.jobTitle}
                        </p>

                      </div>

                      <h3>Updated Fields</h3>

                      <table width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        style="
                          border-collapse:collapse;
                          font-size:14px;
                        ">

                        <tr style="
                          background:#0A66C2;
                          color:white;
                        ">

                          <th style="
                            padding:10px;
                            border:1px solid #ddd;
                          ">
                            Field
                          </th>

                          <th style="
                            padding:10px;
                            border:1px solid #ddd;
                          ">
                            Old Value
                          </th>

                          <th style="
                            padding:10px;
                            border:1px solid #ddd;
                          ">
                            New Value
                          </th>

                        </tr>

                        ${updatedFieldsHtml}

                      </table>

                      <div style="
                        text-align:center;
                        margin-top:30px;
                      ">

                        <a href="${frontendUrl}"
                          style="
                            background:#0A66C2;
                            color:#fff;
                            padding:12px 20px;
                            text-decoration:none;
                            border-radius:6px;
                            font-weight:bold;
                          ">

                          View Details

                        </a>

                      </div>

                      <p style="margin-top:30px;">
                        Regards,<br/>
                        <strong>Placement Team</strong>
                      </p>

                    </td>
                  </tr>

                </table>

              </td>
            </tr>

          </table>

        </div>
        `
      })
    )
  );

  let sent = 0;
  let failed = 0;

  results.forEach((result, index) => {

    if (result.status === "fulfilled") {

      sent++;

      console.log(
        `✅ Student mail sent: ${recipients[index].email}`
      );

    } else {

      failed++;

      console.error(
        `❌ Student mail failed: ${recipients[index].email}`
      );
    }
  });

  console.log(
    `✅ Student update emails → Sent: ${sent}, Failed: ${failed}`
  );
}

module.exports = {
  sendPlacementUpdateStudentEmail
};