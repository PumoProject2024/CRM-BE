require("dotenv").config();

const EMAIL_SENDER =
  `"Pumo Technovation" <${process.env.EMAIL_FROM}>`;

module.exports = {
  EMAIL_SENDER
};