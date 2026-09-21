require("dotenv").config();

const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

const Employee = require("../models/Employee");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlacementEscalationMail(
  recipients,
  requirements
) {

  try {

    if (
      !recipients ||
      recipients.length === 0 ||
      !requirements ||
      requirements.length === 0
    ) {
      return;
    }

    // =========================================
    // FIND REQUIREMENT CREATOR
    // =========================================

    const creatorEmployee = await Employee.findOne({
      where: {
        emp_name: requirements[0]?.createdBy
      }
    });
    const creatorContact =
      creatorEmployee?.contact_num || "-";

    // =========================================
    // COMMON HIGHER EMAILS
    // =========================================

    const commonEmails = [
      "vidharshanapumohr@gmail.com"
    ];

    // =========================================
    // REPORTING MANAGER EMAIL
    // =========================================

    const reportingManagerEmail =
      creatorEmployee?.reportingManagerEmail;

    // =========================================
    // COMBINE EMAILS
    // =========================================

    const allEmails = [

      // Existing recipients
      ...recipients.map(user => user.email),

      // Common management mail
      ...commonEmails,

      // Reporting manager
      reportingManagerEmail

    ].filter(Boolean);

    // =========================================
    // REMOVE DUPLICATES
    // =========================================

    const uniqueEmails = [...new Set(allEmails)];
    console.log("Final Email List:", uniqueEmails);

    // =========================================
    // REQUIREMENT TABLE ROWS
    // =========================================

    const requirementRows = requirements
      .map(req => `

        <tr>

          <td style="
            padding:10px;
            border:1px solid #ddd;
          ">
            ${req.jobReqId}
          </td>

          <td style="
            padding:10px;
            border:1px solid #ddd;
          ">
            ${req.companyName}
          </td>

          <td style="
            padding:10px;
            border:1px solid #ddd;
          ">
            ${req.jobTitle}
          </td>

          <td style="
            padding:10px;
            border:1px solid #ddd;
          ">
            ${req.createdDate}
          </td>
          <td style="
  padding:10px;
  border:1px solid #ddd;
  font-weight:bold;
  color:#dc3545;
">
  ${req.jobAge || "-"}
</td>

          <td style="
            padding:10px;
            border:1px solid #ddd;
            color:#dc3545;
            font-weight:bold;
          ">
            ${req.jobReqStatus}
          </td>

        </tr>

      `)
      .join("");

    // =========================================
    // SEND SINGLE MAIL
    // =========================================

    await Promise.allSettled(

      uniqueEmails.map(email =>

        sgMail.send({

          to: email,

          from: EMAIL_SENDER,

          subject:
            `Escalation Alert - Old Job Requirements`,

          html: `

          <div style="
            font-family:Arial;
            padding:20px;
          ">

            <h2 style="color:#dc3545;">
              Old Job Requirement Alert
            </h2>

            <div style="
              background:#fff3cd;
              color:#856404;
              border:1px solid #ffeeba;
              padding:15px;
              border-radius:8px;
              margin-bottom:20px;
              font-weight:600;
            ">

              Some job requirements are older than
              15 days and are still in Open/Freeze status.

              Kindly take necessary action ASAP.

            </div>
            <div style="
  background:#f8f9fa;
  border:1px solid #dee2e6;
  padding:15px;
  border-radius:8px;
  margin-bottom:20px;
">

  <p style="margin:5px 0;">
    <strong>Job Created By:</strong>
    ${requirements[0]?.createdBy || "-"}
  </p>
<p style="margin:5px 0;">
  <strong>Contact Number:</strong>
  ${creatorContact}
</p>
  <p style="margin:5px 0;">
    <strong>Total Old Requirements:</strong>
    ${requirements.length}
  </p>

</div>

            <h3>
              Old Requirement Summary
            </h3>

            <table
              width="100%"
              cellpadding="0"
              cellspacing="0"
              style="
                border-collapse:collapse;
                margin-top:20px;
              "
            >

              <tr style="
                background:#0A66C2;
                color:white;
              ">

                <th style="
                  padding:10px;
                  border:1px solid #ddd;
                ">
                  Job Req ID
                </th>

                <th style="
                  padding:10px;
                  border:1px solid #ddd;
                ">
                  Company
                </th>

                <th style="
                  padding:10px;
                  border:1px solid #ddd;
                ">
                  Job Title
                </th>

                <th style="
                  padding:10px;
                  border:1px solid #ddd;
                ">
                  Created Date
                </th>
                <th style="
                 padding:10px;
                 border:1px solid #ddd;
                ">
                   Job Age
                </th>
                <th style="
                  padding:10px;
                  border:1px solid #ddd;
                ">
                  Status
                </th>

              </tr>

              ${requirementRows}

            </table>

          </div>

          `

        })

      )

    );

    console.log(
      "✅ Placement escalation mail sent successfully"
    );

  } catch (error) {

    console.error(
      "❌ Placement escalation mail error:",
      error
    );

  }

}

module.exports = {
  sendPlacementEscalationMail
};