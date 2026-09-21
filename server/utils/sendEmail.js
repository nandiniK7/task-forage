import nodemailer from "nodemailer";
import env from "../config/env.js";

let transporter;

const isConfigured = () => Boolean(env.email.user && env.email.pass);

const getTransporter = () => {
  if (transporter !== undefined) return transporter;
  if (!isConfigured()) {
    transporter = null;
    return transporter;
  }

  const base = env.email.host
    ? { host: env.email.host, port: env.email.port, secure: env.email.secure }
    : { service: env.email.service };

  transporter = nodemailer.createTransport({
    ...base,
    auth: { user: env.email.user, pass: env.email.pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transporter;
};

/**
 * Sends one email. This NEVER throws: notifications are best-effort and must not
 * be able to fail the request or job that triggered them. Returns true on success.
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailer = getTransporter();
    if (!mailer) {
      console.warn(`[email] Skipped "${subject}": EMAIL_USER / EMAIL_PASS are not configured.`);
      return false;
    }
    if (!to) return false;

    const info = await mailer.sendMail({
      from: env.email.from || `"TaskForage" <${env.email.user}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`[email] Sent "${subject}" (${info.messageId})`);
    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${subject}":`, error.message);
    return false;
  }
};

export const resetTransporter = () => { transporter = undefined; };

export default sendEmail;
