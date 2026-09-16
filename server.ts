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

      const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer : '';
      let detectedOrigin = originHeader;
      if (!detectedOrigin && refererHeader) {
        try {
          detectedOrigin = new URL(refererHeader).origin;
        } catch {}
      }
      if (!detectedOrigin && req.headers.host) {
        detectedOrigin = `${req.protocol || 'https'}://${req.headers.host}`;
      }
      const targetWebsite = detectedOrigin || 'https://frostly.io';

      const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
      const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to: toEmail.trim(),
        subject: `❄️ Frostly - Google SMTP Test (Activation of this website: ${targetWebsite})`,
        text: `Hello,\n\nThis is an automated confirmation verifying that Google SMTP (smtp.gmail.com:465) is successfully connected and operational for the activation of this website:\n${targetWebsite}\n\nTimestamp: ${new Date().toISOString()}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
            <div style="display: flex; align-items: center; margin-bottom: 20px;">
              <span style="font-size: 24px; margin-right: 8px;">❄️</span>
              <strong style="font-size: 20px; color: #0f172a;">Frostly Seafood Platform</strong>
            </div>
            <div style="padding: 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; margin-bottom: 16px;">
              <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 15px;">Google SMTP Connected Successfully</h3>
              <p style="color: #15803d; margin: 0; font-size: 13px; line-height: 1.5;">
                This test email confirms that transactional email delivery through <strong>smtp.gmail.com:465 (SSL)</strong> is fully functional for the <strong>activation of this website</strong>.
              </p>
            </div>
            <div style="padding: 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Website Target:</div>
              <div style="font-family: monospace; font-size: 13px; color: #4338ca; word-break: break-all;">${targetWebsite}</div>
            </div>
            <p style="font-size: 13px; color: #475569; line-height: 1.6;">
              All future tenant creation confirmation emails and cold-chain alert notifications for this website will route directly through Google SMTP.
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
    const { email, orgName, adminName, confirmationUrl, websiteUrl } = req.body;
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

      // Automatically determine the exact website origin from request headers if not explicitly supplied
      const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : '';
      const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer : '';
      let detectedOrigin = originHeader;
      if (!detectedOrigin && refererHeader) {
        try {
          detectedOrigin = new URL(refererHeader).origin;
        } catch {}
      }
      if (!detectedOrigin && req.headers.host) {
        detectedOrigin = `${req.protocol || 'https'}://${req.headers.host}`;
      }

      const targetWebsite = websiteUrl || detectedOrigin || 'https://frostly.io';
      const targetLink = confirmationUrl || (targetWebsite ? `${targetWebsite}?activated=true&email=${encodeURIComponent(email.trim())}` : 'https://frostly.io');

      await transporter.sendMail({
        from: `"${fromName}" <${fromUser}>`,
        to: email.trim(),
        subject: `❄️ Activation of this website: Confirm your ${targetOrg} Account - Frostly`,
        text: `Hello ${recipientName},\n\nActivation of this website (${targetWebsite}) is required to complete registration for your organization: ${targetOrg}.\n\nPlease click the link below to complete the activation of this website:\n${targetLink}\n\nWebsite to activate: ${targetWebsite}\nOrganization: ${targetOrg}\nAdministrator: ${recipientName} (${email})\n\nIf you did not request the activation of this website, you can safely ignore this email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #0f172a;">
            <div style="display: flex; align-items: center; margin-bottom: 24px;">
              <span style="font-size: 26px; margin-right: 10px;">❄️</span>
              <strong style="font-size: 20px; color: #0f172a; letter-spacing: -0.02em;">Frostly Seafood Platform</strong>
            </div>

            {/* Prominent Website Activation Banner */}
            <div style="background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">
                Action Required
              </div>
              <h2 style="font-size: 17px; color: #1e1b4b; font-weight: 700; margin: 0 0 6px 0; line-height: 1.3;">
                Activation of this website is requested
              </h2>
              <p style="font-size: 13px; color: #3730a3; margin: 0; line-height: 1.5;">
                Please complete the activation of this website to authorize your administrator account for <strong>${targetOrg}</strong>.
              </p>
            </div>

            <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 16px 0;">
              Hello <strong>${recipientName}</strong>,
            </p>

            <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
              Your tenant workspace for <strong>${targetOrg}</strong> has been provisioned. Click the button below to complete the activation of this website and access your cold-chain operations console.
            </p>

            {/* Big Primary Action Button */}
            <div style="margin: 28px 0; text-align: left;">
              <a href="${targetLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2);">
                Complete Activation of this Website
              </a>
            </div>

            {/* Explicit Target Website Details Block */}
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0;">
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
                Website Activation Details
              </div>
              <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
                <strong>Website:</strong> <span style="font-family: monospace; color: #4338ca;">${targetWebsite}</span>
              </div>
              <div style="font-size: 12px; color: #475569; margin-bottom: 6px;">
                <strong>Organization:</strong> ${targetOrg}
              </div>
              <div style="font-size: 12px; color: #475569;">
                <strong>Administrator Email:</strong> ${email}
              </div>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 16px 0 0 0;">
              If the button above does not work, copy and paste this direct website activation URL into your browser:<br/>
              <span style="color: #4f46e5; word-break: break-all; font-family: monospace; font-size: 11px;">${targetLink}</span>
            </p>

            <div style="border-top: 1px solid #e2e8f0; padding-top: 18px; margin-top: 28px; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              Dispatched via Google SMTP (smtp.gmail.com:465) for the activation of this website.<br/>
              If you did not initiate this activation, no further action is required.
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
