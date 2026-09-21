require("dotenv").config();
const sgMail = require("@sendgrid/mail");
const { EMAIL_SENDER } = require("../config/mailConfig");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendPlacementEmail = async (
    toEmail,
    placementData
) => {
    try {

        const msg = {
            to: toEmail,
            from: EMAIL_SENDER,
            subject: `Placement Status Updated - ${placementData.placementStatus}`,

            html: `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
    <tr>
      <td align="center">

        <table
          width="650"
          cellpadding="0"
          cellspacing="0"
          style="
            background:#ffffff;
            border-radius:10px;
            overflow:hidden;
            box-shadow:0 4px 12px rgba(0,0,0,0.1);
          "
        >

          <tr>
            <td
              style="
                background:#0A66C2;
                padding:20px;
                text-align:center;
              "
            >
              <h2 style="color:white;margin:0;">
                🎉 Placement Status Updated
              </h2>
            </td>
          </tr>

          <tr>
            <td style="padding:30px;">

              <p>
                Dear
                <strong>${placementData.studentName}</strong>,
              </p>

              ${placementData.placementStatus ===
                    "Placed"
                    ? `
                    <p style="
                      background:#ecfdf5;
                      border-left:4px solid #10b981;
                      padding:12px;
                      color:#065f46;
                    ">
                      Congratulations! You have been marked has placed.
                    </p>
                  `
                    : `
                    <p style="
                      background:#fff7ed;
                      border-left:4px solid #f97316;
                      padding:12px;
                      color:#9a3412;
                    ">
                      Your placement status marked as
                      "Placed but not accepted the Offer".
                    </p>
                  `
                }

              <table
                width="100%"
                cellpadding="10"
                cellspacing="0"
                style="
                  border-collapse:collapse;
                  margin-top:20px;
                "
              >

                <tr>
                  <td style="border:1px solid #ddd;"><b>Student ID</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.studentId}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Status</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.placementStatus}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Company Name</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.companyName || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Company Location</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.companyLocation || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Job Role</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.jobRole || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Package</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.package || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Placement Date</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.placementDate || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Joining Date</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.joiningDate || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Placed By</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.placedBy || "-"}
                  </td>
                </tr>

                <tr>
                  <td style="border:1px solid #ddd;"><b>Remarks</b></td>
                  <td style="border:1px solid #ddd;">
                    ${placementData.placementRemarks || "-"}
                  </td>
                </tr>

              </table>

              <div style="margin-top:25px;">
                <p style="
                  background:#eef4ff;
                  padding:12px;
                  border-left:4px solid #0A66C2;
                  font-size:14px;
                ">
                  Status was updated by
                  <strong>
                    ${placementData.statusUpdatedBy}
                  </strong>
                </p>
              </div>

             ${placementData.placementStatus === "Placed"
                    ? `
      <p style="margin-top:25px;">
        We wish you success in your professional journey.
      </p>
    `
                    : `
      <p style="
        margin-top:25px;
        background:#fff7ed;
        border-left:4px solid #f97316;
        padding:12px;
        color:#9a3412;
      ">
        Our records indicate that the offer has not been accepted.
        If this information is incorrect, please contact the Placement Team immediately.
      </p>
    `
                }
              <p>
                Regards,<br/>
                <strong>Pumo Technovation Placement Team</strong>
              </p>

            </td>
          </tr>

          <tr>
            <td
              style="
                background:#f1f5f9;
                text-align:center;
                padding:15px;
                font-size:12px;
                color:#666;
              "
            >
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

        await sgMail.send(msg);

    } catch (error) {
        console.error("Placement mail error:", error);
    }
};

module.exports = {
    sendPlacementEmail
};