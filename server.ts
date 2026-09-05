import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const maskedUser = user.length > 2 ? `${user.slice(0, 2)}***` : `${user[0]}*`;
  return `${maskedUser}@${domain}`;
}

function getGoogleSmtpTransporter() {
  const user = process.env.GOOGLE_SMTP_USER;
  const pass = process.env.GOOGLE_SMTP_APP_PASSWORD;
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // SSL
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ''), // strip spaces from 16-char app password
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Google SMTP Configuration and Status Endpoint
  app.get('/api/smtp/config', (req, res) => {
    const user = process.env.GOOGLE_SMTP_USER;
    const pass = process.env.GOOGLE_SMTP_APP_PASSWORD;
    const fromEmail = process.env.GOOGLE_SMTP_FROM_EMAIL || user;
    const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

    res.json({
      configured: Boolean(user && pass),
      provider: 'google_smtp',
      host: 'smtp.gmail.com',
      ports: {
        ssl: 465,
        tls: 587,
      },
      user: user ? maskEmail(user) : null,
      fromEmail: fromEmail ? maskEmail(fromEmail) : null,
      fromName,
      supabaseInstructions: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: user || 'your-google-email@gmail.com',
        senderEmail: fromEmail || 'your-google-email@gmail.com',
        senderName: fromName,
      },
    });
  });

  // Google SMTP Test Connection & Verification Endpoint
  app.post('/api/smtp/test', async (req, res) => {
    const { toEmail } = req.body;
    if (!toEmail || typeof toEmail !== 'string') {
      res.status(400).json({ error: 'Valid recipient email is required' });
      return;
    }

    const transporter = getGoogleSmtpTransporter();
    if (!transporter) {
      res.status(200).json({
        success: false,
        configured: false,
        message: 'Google SMTP credentials not yet provided in environment. Please set GOOGLE_SMTP_USER and GOOGLE_SMTP_APP_PASSWORD.',
        setupGuide: {
          step1: 'Enable 2-Step Verification on your Google Account (myaccount.google.com/security).',
          step2: 'Generate a 16-character App Password at myaccount.google.com/apppasswords under "Mail".',
          step3: 'Set GOOGLE_SMTP_USER (your Gmail/Workspace address) and GOOGLE_SMTP_APP_PASSWORD.',
          step4: 'In Supabase Dashboard, navigate to Authentication > SMTP Settings and enter smtp.gmail.com (Port 465, SSL).',
        },
      });
      return;
    }

    try {
      // Verify SMTP transport connection
      await transporter.verify();

      const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
      const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to: toEmail.trim(),
        subject: '❄️ Frostly Cold-Chain Platform - Google SMTP Connection Test',
        text: `Hello,\n\nThis is an automated confirmation verifying that Google SMTP (smtp.gmail.com:465) is successfully connected and operational for Frostly.\n\nTimestamp: ${new Date().toISOString()}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <span style="font-size: 24px; margin-right: 8px;">❄️</span>
              <strong style="font-size: 20px; color: #0f172a;">Frostly Seafood Platform</strong>
            </div>
            <div style="padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; margin-bottom: 16px;">
              <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 15px;">Google SMTP Connected Successfully</h3>
              <p style="color: #15803d; margin: 0; font-size: 13px; line-height: 1.5;">
                This test email confirms that transactional email delivery through <strong>smtp.gmail.com:465 (SSL)</strong> is fully functional.
              </p>
            </div>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              All future tenant creation confirmation emails and cold-chain alert notifications will route directly through Google SMTP.
            </p>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; font-size: 11px; color: #94a3b8;">
              Dispatched by Frostly Cold-Chain Platform via Google SMTP at ${new Date().toUTCString()}
            </div>
          </div>
        `,
      });

      res.json({
        success: true,
        configured: true,
        messageId: info.messageId,
        recipient: toEmail,
        message: 'Test email successfully dispatched via Google SMTP (smtp.gmail.com:465).',
      });
    } catch (err: any) {
      console.error('Google SMTP dispatch error:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to send test email through Google SMTP',
        code: err?.code,
      });
    }
  });

  // Google SMTP Direct Confirmation Email Endpoint
  app.post('/api/smtp/send-confirmation', async (req, res) => {
    const { email, orgName, adminName, confirmationUrl } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Recipient email is required' });
      return;
    }

    const transporter = getGoogleSmtpTransporter();
    if (!transporter) {
      // Return gracefully so client falls back to Supabase auth confirmation dispatch
      res.status(200).json({
        sentDirectly: false,
        message: 'Google SMTP credentials not detected in local server environment. Supabase Auth SMTP dispatch will handle verification.',
      });
      return;
    }

    try {
      const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
      const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';
      const targetOrg = orgName || 'Your Organization';
      const recipientName = adminName || email.split('@')[0];
      const targetLink = confirmationUrl || 'https://frostly.io';

      await transporter.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to: email.trim(),
        subject: `❄️ Confirm your ${targetOrg} Administrator Account - Frostly`,
        text: `Hello ${recipientName},\n\nPlease confirm your administrator email for ${targetOrg} on the Frostly Cold-Chain Platform.\n\nVerify Address: ${targetLink}\n\nIf you did not request this, you can ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="margin-bottom: 24px;">
              <span style="font-size: 24px; vertical-align: middle;">❄️</span>
              <strong style="font-size: 20px; color: #0f172a; margin-left: 8px; vertical-align: middle;">Frostly Cold-Chain Platform</strong>
            </div>
            <h2 style="font-size: 18px; color: #0f172a; margin: 0 0 12px 0;">
              Confirm your Administrator Account
            </h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
              Hello <strong>${recipientName}</strong>,
            </p>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
              Your cold-chain tenant organization <strong>${targetOrg}</strong> has been created. Click the button below to confirm your administrator email address and launch your workspace.
            </p>
            <div style="margin: 24px 0;">
              <a href="${targetLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; display: inline-block;">
                Confirm Email &amp; Launch Workspace
              </a>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
              Or copy and paste this verification URL into your browser:<br/>
              <span style="color: #4f46e5; word-break: break-all;">${targetLink}</span>
            </p>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; font-size: 11px; color: #94a3b8;">
              Dispatched via Google SMTP (smtp.gmail.com) • Frostly Cold-Chain Platform
            </div>
          </div>
        `,
      });

      res.json({
        sentDirectly: true,
        message: 'Confirmation email dispatched directly through Google SMTP (smtp.gmail.com:465).',
      });
    } catch (err: any) {
      console.warn('Failed to send confirmation email via direct Google SMTP:', err);
      res.status(500).json({
        sentDirectly: false,
        error: err?.message || 'Google SMTP dispatch encountered an error',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frostly server running with Google SMTP on http://0.0.0.0:${PORT}`);
  });
}

startServer();
