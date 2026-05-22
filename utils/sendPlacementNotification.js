require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPlacementNotification(recipients, placementData) {
  if (!recipients || recipients.length === 0) {
    console.warn("⚠️ No staff emails found. Skipping placement email.");
    return;
  }

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    recipients.map(user => sgMail.send({
      to: user.email,
      from: EMAIL_SENDER,
      subject: `New Job Opening - ${placementData.jobTitle}`,
      html: `
    <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;">
        <tr>
          <td align="center">

            <table width="100%" cellpadding="0" cellspacing="0"
              style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.05);">

              <!-- Header with Logo -->
              <tr>
                <td style="background:#0A66C2;padding:15px;text-align:center;">
                  <img 
                    src="${frontendUrl}/images/logo.png"
                    alt="Company Logo"
                    width="120"
                    style="display:block;margin:auto;"
                  />
                </td>
              </tr>

              <!-- Title -->
              <tr>
                <td style="background:#0A66C2;padding:12px;text-align:center;">
                  <h2 style="color:#ffffff;margin:0;font-size:18px;">
                    New Job Requirement
                  </h2>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:20px;color:#000000;font-size:14px;line-height:1.6;">

                <p>Hello ${user.name || ""},</p>

                  <p>A new job requirement has been created:</p>

                  <!-- Job Title Highlight -->
                  <div style="
                    font-size:16px;
                    font-weight:bold;
                    background:#eeeeee;
                    padding:10px;
                    border-radius:6px;
                    display:inline-block;
                    color:#000;">
                    ${placementData.jobTitle}
                  </div>

                  <!-- Details -->
                  <p style="margin-top:15px;color:#000;">
                    <strong>Company:</strong> ${placementData.companyName}<br/>
                    <strong>Department:</strong> ${placementData.department || "N/A"}<br/>
                    <strong>Location:</strong> ${placementData.jobLocation || "N/A"}
                  </p>

                  <!-- Info Box -->
                  <div style="
                    margin-top:15px;
                    padding:12px;
                    border:1px solid #ddd;
                    border-radius:6px;
                    background:#f9f9f9;
                    color:#000;">
                    <strong>Interview Date:</strong> ${placementData.interviewDate || "TBD"}<br/>
                    <strong>Allowed Branches:</strong> ${placementData.allowedBranches || "All Branches"}
                  </div>

                  <!-- Highlight Instruction -->
                  <div style="
                    margin-top:20px;
                    padding:14px;
                    border-left:5px solid #0A66C2;
                    background:#f0f7ff;
                    border-radius:6px;
                    font-size:14px;
                    color:#000;
                    font-weight:bold;">
                    📌 Map eligible students to this requirement and guide them to acknowledge this opportunity through the portal.
                  </div>

                  <!-- View Details Section -->
                  <div style="text-align:center;margin:25px 0;">

                    <p style="
                      font-size:14px;
                      font-weight:bold;
                      color:#0A66C2;
                      margin-bottom:10px;">
                      For more information about this requirement, click below:
                    </p>

                    <a href="${frontendUrl}"
                      style="
                        background:#0A66C2;
                        color:#ffffff;
                        padding:12px 22px;
                        text-decoration:none;
                        border-radius:6px;
                        font-weight:bold;
                        display:inline-block;
                        font-size:14px;">
                      View Details
                    </a>

                  </div>
                  <p style="
                  font-size:12px;
                  color:#555;
                  text-align:center;
                  margin-top:10px;">
                 ⚠️ This portal is best viewed on a desktop for an optimal experience.
                 </p>

                  <p style="margin-top:20px;color:#000;">
                    Regards,<br/>
                    <strong>Placement Team</strong>
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="
                  background:#eeeeee;
                  padding:12px;
                  text-align:center;
                  font-size:12px;
                  color:#000;">
                  © ${new Date().getFullYear()} Pumo Technovation
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

  results.forEach(result => {
    if (result.status === "fulfilled") sent++;
    else failed++;
  });

  console.log(`✅ Placement emails → Sent: ${sent}, Failed: ${failed}`);
}

async function sendPlacementUpdateNotification(recipients, updateData) {

  if (!recipients || recipients.length === 0) {
    console.warn("⚠️ No recipients found");
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

          <td style="padding:8px;border:1px solid #ddd;color:#b91c1c;">
            ${values.oldValue}
          </td>

          <td style="padding:8px;border:1px solid #ddd;color:#15803d;">
            ${values.newValue}
          </td>
        </tr>
      `;
    }
  );

  const results = await Promise.allSettled(

    recipients.map(user =>
      sgMail.send({

        to: user.email,
        from: EMAIL_SENDER,

        subject: `Job Requirement Updated - ${updateData.jobTitle}`,

        html: `
        <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

          <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px;">
            <tr>
              <td align="center">

                <table width="100%" cellpadding="0" cellspacing="0"
                  style="max-width:700px;background:#ffffff;border-radius:10px;overflow:hidden;">

                  <tr>
                    <td style="background:#0A66C2;padding:18px;text-align:center;">
                      <h2 style="color:#fff;margin:0;">
                        Job Requirement Updated
                      </h2>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:20px;color:#000;">

                      <p>Hello ${user.name || ""},</p>

                      <p>A job requirement has been updated.</p>

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
                        style="border-collapse:collapse;font-size:14px;">

                        <tr style="background:#0A66C2;color:white;">

                          <th style="padding:10px;border:1px solid #ddd;">
                            Field
                          </th>

                          <th style="padding:10px;border:1px solid #ddd;">
                            Old Value
                          </th>

                          <th style="padding:10px;border:1px solid #ddd;">
                            New Value
                          </th>

                        </tr>

                        ${updatedFieldsHtml}

                      </table>

                      <div style="text-align:center;margin-top:30px;">

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

  results.forEach(result => {
    if (result.status === "fulfilled") sent++;
    else failed++;
  });

  console.log(`✅ Update emails → Sent: ${sent}, Failed: ${failed}`);
}

module.exports = { sendPlacementNotification,sendPlacementUpdateNotification };