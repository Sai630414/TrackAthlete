const https = require('https');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Send email via Brevo Transactional Email REST API using Node native https module.
 * Explicitly manages TLS sockets and prevents undici UND_ERR_SOCKET issues in Vercel serverless.
 */
function sendBrevoEmail({ toEmail, toName, subject, htmlContent, textContent }) {
  return new Promise((resolve, reject) => {
    const rawKey = process.env.BREVO_API_KEY || '';
    const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, '');
    const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'saikondareddypala@gmail.com').trim().replace(/^['"]|['"]$/g, '');
    const senderName = (process.env.BREVO_SENDER_NAME || 'TrackAthlete').trim().replace(/^['"]|['"]$/g, '');

    if (!apiKey) {
      console.log('\n==================================================');
      console.log(`[BREVO MAILER SIMULATOR - NO BREVO_API_KEY SET]`);
      console.log(`To: ${toName ? `${toName} <${toEmail}>` : toEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content:\n${textContent || htmlContent}`);
      console.log('==================================================\n');
      return resolve({ success: true, simulated: true });
    }

    const payload = JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail.trim(), name: (toName || toEmail.split('@')[0]).trim() }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent || htmlContent.replace(/<[^>]+>/g, '')
    });

    const options = {
      hostname: 'api.brevo.com',
      port: 443,
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'TrackAthlete-Mailer/1.0',
        'Connection': 'close'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let responseData = {};
        try { responseData = JSON.parse(data); } catch (e) { responseData = { message: data || 'Non-JSON response' }; }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve({ success: true, data: responseData, statusCode: res.statusCode });
        } else {
          console.error(`[Brevo API Error ${res.statusCode}]`, {
            status: res.statusCode,
            brevoCode: responseData.code,
            brevoMessage: responseData.message
          });
          const err = new Error(`Brevo API HTTP ${res.statusCode}: ${responseData.message || res.statusMessage || 'Request failed'}`);
          err.statusCode = res.statusCode;
          err.responseData = responseData;
          return reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Brevo API request timed out after 10000ms'));
    });

    req.on('error', (netErr) => {
      console.error('[Brevo Network Error]', {
        name: netErr.name,
        message: netErr.message,
        code: netErr.code
      });
      reject(new Error(`Brevo network failure: ${netErr.message} (code: ${netErr.code || 'UNKNOWN'})`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Send Forgot Password 6-Digit OTP Email
 */
async function sendForgotPasswordOTP({ toEmail, name, otp }) {
  const subject = `TrackAthlete - Password Reset Code: ${otp}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f4; margin: 0; padding: 20px; color: #1d2c31; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #d8ded5; box-shadow: 0 4px 16px rgba(0,0,0,0.05); }
          .header { display: flex; align-items: center; margin-bottom: 24px; }
          .brand-logo { background: #e87859; color: #173d3c; font-weight: 900; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px; }
          .brand-title { font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #173235; }
          h2 { font-family: Georgia, serif; color: #173235; font-size: 24px; margin-top: 0; }
          p { font-size: 15px; line-height: 1.6; color: #526668; }
          .otp-box { background: #e2eee4; border: 2px dashed #2f6d5a; border-radius: 10px; padding: 20px; text-align: center; margin: 28px 0; }
          .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #194e42; font-family: monospace; }
          .expiry { font-size: 12px; color: #697c7c; margin-top: 8px; }
          .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e9ece7; font-size: 12px; color: #81908e; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="brand-logo">ta</span>
            <span class="brand-title">trackathlete</span>
          </div>
          <h2>Reset Your Password</h2>
          <p>Hello ${name || 'Athlete'},</p>
          <p>We received a request to reset your password for your TrackAthlete account. Use the 6-digit verification code below to set a new password:</p>
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <div class="expiry">This code is valid for 15 minutes.</div>
          </div>
          <p>If you did not request a password reset, please ignore this email. Your account security remains intact.</p>
          <div class="footer">
            TrackAthlete Platform &middot; Empowering Indian Sports Ecosystem
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `TrackAthlete Password Reset\n\nHello ${name || 'User'},\n\nYour 6-digit password reset code is: ${otp}\n\nThis code will expire in 15 minutes. If you did not request this, please ignore this email.`;

  return sendBrevoEmail({ toEmail, toName: name, subject, htmlContent, textContent });
}

/**
 * Send Welcome Email on Signup
 */
async function sendWelcomeEmail({ toEmail, name, role }) {
  const subject = `Welcome to TrackAthlete! 🏆`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f4; margin: 0; padding: 20px; color: #1d2c31; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #d8ded5; }
          .brand-logo { background: #e87859; color: #173d3c; font-weight: 900; width: 32px; height: 32px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px; }
          .brand-title { font-family: Georgia, serif; font-size: 20px; font-weight: 700; color: #173235; }
          h2 { font-family: Georgia, serif; color: #173235; font-size: 24px; }
          p { font-size: 15px; line-height: 1.6; color: #526668; }
          .badge { display: inline-block; background: #e2eee4; color: #194e42; font-weight: 800; padding: 4px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; }
          .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e9ece7; font-size: 12px; color: #81908e; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="margin-bottom: 24px;">
            <span class="brand-logo">ta</span>
            <span class="brand-title">trackathlete</span>
          </div>
          <span class="badge">${role || 'User'} Profile Active</span>
          <h2>Welcome aboard, ${name}!</h2>
          <p>Thank you for joining TrackAthlete. Your workspace is ready and setup for your sporting journey.</p>
          <p>Explore verified pathways, manage your profiles, connect with coaches, academies, and sponsors seamlessly.</p>
          <div class="footer">
            TrackAthlete Platform &middot; Built for the Indian Sports Ecosystem
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({ toEmail, toName: name, subject, htmlContent });
}

/**
 * Send Confirmation Email after Password Change
 */
async function sendPasswordResetSuccessEmail({ toEmail, name }) {
  const subject = `Security Notice: TrackAthlete Password Changed`;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f4; margin: 0; padding: 20px; color: #1d2c31; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 36px; border: 1px solid #d8ded5; }
          h2 { font-family: Georgia, serif; color: #173235; font-size: 22px; }
          p { font-size: 15px; line-height: 1.6; color: #526668; }
          .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e9ece7; font-size: 12px; color: #81908e; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Changed Successfully</h2>
          <p>Hello ${name || 'User'},</p>
          <p>Your TrackAthlete account password was successfully updated. If you performed this action, no further steps are required.</p>
          <p style="color: #c85c40;">If you did not initiate this change, please contact support immediately to secure your account.</p>
          <div class="footer">
            TrackAthlete Platform &middot; Security Alert
          </div>
        </div>
      </body>
    </html>
  `;

  return sendBrevoEmail({ toEmail, toName: name, subject, htmlContent });
}

module.exports = {
  sendBrevoEmail,
  sendForgotPasswordOTP,
  sendWelcomeEmail,
  sendPasswordResetSuccessEmail
};
