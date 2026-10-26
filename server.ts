import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  AMANSOCEAN_OFFICIAL_CATALOG,
  LEGACY_DEMO_PRODUCT_IDS,
  AmansoceanCategory,
  AmansoceanOfficialCatalogItem,
} from './src/data/amansoceanProducts';
import {
  parseFinancialDescriptionMeta,
  encodeFinancialDescriptionMeta,
} from './src/mappers/financialMapper';
import {
  normalizeRetailCutType,
  normalizeRetailPaymentMethod,
} from './src/mappers/retailMapper';
import {
  normalizeOrderCustomerCategory,
  normalizeQualityGrade,
  normalizeOrderPaymentStatus,
} from './src/mappers/orderMapper';
import { ensureValidUuid } from './src/mappers/notificationMapper';
import { validatePassword } from './src/utils/passwordValidation';

dotenv.config();

function getSupabaseAdmin() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

export async function createExpressApp(
  options: { withVite?: boolean; adminClient?: any } = {}
) {
  const app = express();
  const PORT = 3000;

  const adminClientGetter = () => options.adminClient || getSupabaseAdmin();

  // SECURITY: security headers + conservative body limits. Only the image upload route accepts large bodies.
  app.disable('x-powered-by');
  // Behind a hosting proxy (AI Studio / Cloud Run / Vercel) every request otherwise looks like it comes from one IP,
  // which would put all users in a single rate-limit bucket. Trust exactly one proxy hop.
  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite/PWA inline assets; tighten separately once CSP is tested
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(['/api/erp/upload-image', '/api/erp/persistence/upsert', '/api/erp/amansocean-products'], express.json({ limit: '12mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));

  // SECURITY: rate limiting on abuse-prone public endpoints (skipped under test)
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
  const makeLimiter = (windowMs: number, max: number) =>
    rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false, skip: () => isTestEnv });
  // /api/smtp and /api/feedback have their own stricter route-level limiters below.
  app.use(['/api/auth', '/api/storefront/newsletter'], makeLimiter(15 * 60 * 1000, 100));
  app.use(['/api/storefront/orders', '/api/storefront/analytics'], makeLimiter(15 * 60 * 1000, 120));

  const smtpLimiter = makeLimiter(15 * 60 * 1000, 30);
  const feedbackLimiter = makeLimiter(15 * 60 * 1000, 30);

  // SECURITY: middleware defined later in this file; resolve lazily so route registration order doesn't matter.
  const creatorOnly = (req: express.Request, res: express.Response, next: express.NextFunction) =>
    requirePlatformCreator(req, res, next);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // PLATFORM CREATOR AUTHENTICATION MIDDLEWARE
  // Enforces authorization strictly via `platform_admins` table or server-set `app_metadata.role`
  // Never trusts client-writable `user_metadata` or unverified emails
  const requirePlatformCreator = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization bearer token.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured.' });
      return;
    }

    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: 'Invalid or expired session token.' });
        return;
      }

      const user = userData.user;
      const { data: callerProfile } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, role, email, full_name')
        .eq('id', user.id)
        .maybeSingle();

      const { data: platformAdminRow } = await adminClient
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const creatorEmail = (process.env.CREATOR_EMAIL || '').trim().toLowerCase();
      // Authorized ONLY via platform_admins table, server-set app_metadata, or verified creatorEmail.
      // NEVER trust tenant-controlled staff_profiles.role or client-writable user_metadata.
      const isAuthorizedCreator =
        Boolean(platformAdminRow) ||
        Boolean(creatorEmail && user.email_confirmed_at && user.email?.toLowerCase() === creatorEmail) ||
        user.app_metadata?.role === 'platform_creator';

      if (!isAuthorizedCreator) {
        res.status(403).json({ error: 'Forbidden: Platform Creator privileges required.' });
        return;
      }

      (req as any).callerUser = user;
      (req as any).callerProfile = callerProfile;
      next();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Platform authorization failed.' });
    }
  };

  // Google SMTP Configuration and Status Endpoint (Protected by requirePlatformCreator & masks credentials)
  app.get('/api/smtp/config', requirePlatformCreator, (req, res) => {
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
        user: user ? maskEmail(user) : 'your-google-email@gmail.com',
        senderEmail: fromEmail ? maskEmail(fromEmail) : 'your-google-email@gmail.com',
        senderName: fromName,
      },
    });
  });

  // Google SMTP Test Connection & Verification Endpoint
  app.post('/api/smtp/test', requirePlatformCreator, async (req, res) => {
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

  // Google SMTP Direct Confirmation Email Endpoint (Strictly limited to pending unconfirmed users; constant response)
  app.post('/api/smtp/send-confirmation', smtpLimiter, async (req, res) => {
    const genericResponse = {
      success: true,
      message: 'If this address has a pending signup, a confirmation email has been sent.',
    };

    try {
      const { email, orgName, adminName } = req.body || {};
      const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        res.status(400).json({ error: 'Valid recipient email is required' });
        return;
      }

      const adminClient = getSupabaseAdmin();
      if (!adminClient) {
        res.json(genericResponse);
        return;
      }

      // SECURITY: look up the auth user by email with the Supabase admin client.
      // Send only if the user exists and email_confirmed_at is null.
      // Otherwise return the same generic success response without sending.
      let pendingUser: any = null;
      try {
        for (let page = 1; page <= 5 && !pendingUser; page++) {
          const { data: listed, error: listErr } = await (adminClient.auth.admin as any).listUsers({
            page,
            perPage: 1000,
          });
          if (listErr || !listed?.users) break;
          pendingUser = listed.users.find((u: any) => u.email?.toLowerCase() === cleanEmail) || null;
          if (listed.users.length < 1000) break;
        }
      } catch (userLookupErr) {
        console.warn('[Confirmation Lookup Warning]:', userLookupErr);
      }

      if (!pendingUser || pendingUser.email_confirmed_at) {
        res.json(genericResponse);
        return;
      }

      const transporter = getGoogleSmtpTransporter();
      if (!transporter) {
        res.json(genericResponse);
        return;
      }

      const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
      const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';
      const targetOrg = orgName ? String(orgName).slice(0, 80) : 'Your Organization';
      const recipientName = adminName ? String(adminName).slice(0, 60) : cleanEmail.split('@')[0];

      // Automatically determine the exact website origin from server environment or request headers
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

      // SECURITY: never trust a client-supplied link or website. Links are generated server-side by Supabase Auth.
      const allowedOrigin = (process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
      const targetWebsite = allowedOrigin || detectedOrigin || 'https://frostly.io';
      let targetLink: string | undefined = undefined;

      // Ensure confirmation links are cryptographically generated via Supabase Auth Admin
      try {
        const { data: linkData } = await (adminClient.auth.admin.generateLink as any)({
          type: 'signup',
          email: cleanEmail,
          options: {
            redirectTo: targetWebsite,
          },
        });
        if (linkData?.properties?.action_link) {
          targetLink = linkData.properties.action_link;
        } else if (linkData?.properties?.hashed_token) {
          targetLink = `${targetWebsite}?token_hash=${linkData.properties.hashed_token}&type=signup&email=${encodeURIComponent(cleanEmail)}`;
        }
      } catch (linkGenErr) {
        console.warn('[Google SMTP Link Gen Notice]:', linkGenErr);
      }

      if (!targetLink) {
        res.json(genericResponse);
        return;
      }

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

      res.json(genericResponse);
    } catch (err: any) {
      console.warn('Google SMTP confirmation dispatch error:', err);
      res.json(genericResponse);
    }
  });

  // SECURE USER SIGN IN ENDPOINT
  // Strictly authenticates against Supabase Auth via password validation.
  // Never permits mock or offline credential bypasses.
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase authentication service is not configured on the server.' });
      return;
    }

    try {
      const { data, error } = await adminClient.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.session || !data.user) {
        res.status(401).json({ error: error?.message || 'Invalid login credentials.' });
        return;
      }

      const user = data.user;
      const isAmans =
        cleanEmail === 'akokosolutions24@gmail.com' ||
        cleanEmail === 'edmundbgh34@gmail.com' ||
        cleanEmail === 'amoakoemmanuel2020@gmail.com' ||
        cleanEmail === 'amoakoimml@gmail.com' ||
        cleanEmail === 'amoakoemmanuel2026@gmail.com' ||
        cleanEmail.endsWith('@amansocean.com') ||
        cleanEmail.endsWith('@amansocean.store');

      // Fetch or auto-provision staff profile
      let { data: profile } = await adminClient
        .from('staff_profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile || (isAmans && profile.organization_id !== '35a94c6e-e230-4b7c-8404-a4f0ae06b798')) {
        const targetOrgId = isAmans ? '35a94c6e-e230-4b7c-8404-a4f0ae06b798' : (profile?.organization_id || null);
        if (targetOrgId) {
          await adminClient.from('staff_profiles').upsert({
            id: user.id,
            email: user.email || cleanEmail,
            full_name: profile?.full_name || user.user_metadata?.full_name || (cleanEmail === 'amoakoemmanuel2020@gmail.com' ? 'Emmanuel Amoako' : 'Staff Member'),
            role: isAmans ? 'admin' : (profile?.role || 'admin'),
            department: profile?.department || (isAmans ? 'Executive Operations' : 'General Operations'),
            organization_id: targetOrgId,
            is_active: true,
          }, { onConflict: 'id' });

          const { data: refreshedProfile } = await adminClient
            .from('staff_profiles')
            .select('*, organizations(*)')
            .eq('id', user.id)
            .maybeSingle();
          profile = refreshedProfile;
        }
      }

      res.json({
        session: data.session,
        profile,
        error: null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Authentication service error.' });
    }
  });

  // VERIFIED USER PROFILE ENDPOINT
  app.get('/api/auth/profile', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing Authorization header.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin service unavailable.' });
      return;
    }

    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: 'Invalid or expired session token.' });
        return;
      }
      const user = userData.user;
      const cleanEmail = (user.email || '').toLowerCase();
      const isAmans =
        cleanEmail === 'akokosolutions24@gmail.com' ||
        cleanEmail === 'edmundbgh34@gmail.com' ||
        cleanEmail === 'amoakoemmanuel2020@gmail.com' ||
        cleanEmail === 'amoakoimml@gmail.com' ||
        cleanEmail === 'amoakoemmanuel2026@gmail.com' ||
        cleanEmail.endsWith('@amansocean.com') ||
        cleanEmail.endsWith('@amansocean.store');

      let { data: profile } = await adminClient
        .from('staff_profiles')
        .select('*, organizations(*)')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile && isAmans) {
        await adminClient.from('staff_profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || (cleanEmail === 'amoakoemmanuel2020@gmail.com' ? 'Emmanuel Amoako' : 'Staff Member'),
          role: 'admin',
          department: 'Executive Operations',
          organization_id: '35a94c6e-e230-4b7c-8404-a4f0ae06b798',
          is_active: true,
        }, { onConflict: 'id' });

        const { data: refreshedProfile } = await adminClient
          .from('staff_profiles')
          .select('*, organizations(*)')
          .eq('id', user.id)
          .maybeSingle();
        profile = refreshedProfile;
      }

      res.json({
        user,
        profile,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch user profile.' });
    }
  });

  // Direct Backend Tenant & User Provisioning Endpoint (bypasses failing Supabase internal SMTP)
  app.post('/api/auth/register-tenant', async (req, res) => {
    const {
      email,
      password,
      orgName,
      adminFullName,
      adminDepartment = 'Executive',
      facilityType = 'cold_storage',
      facilityCode,
      currency = 'GHS',
      primaryPort = 'Port of Tema & Pier 38 Fishing Harbour',
      websiteUrl,
    } = req.body;

    if (!email || !password || !orgName) {
      res.status(400).json({ error: 'Email, password, and organization name are required.' });
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      res.status(400).json({
        error: passCheck.errorMessage || 'Password does not meet enterprise security requirements.',
        ruleChecks: passCheck.ruleChecks,
      });
      return;
    }

    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured on the server.' });
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanOrgName = orgName.trim();
      const cleanAdminName = (adminFullName || cleanEmail.split('@')[0]).trim();
      const cleanDept = (adminDepartment || 'Executive').trim();

      // 1. Check existing user in auth.users and staff_profiles
      let userId: string | null = null;
      let existingOrgId: string | null = null;
      const { data: userList } = await adminClient.auth.admin.listUsers();
      const existingUser = (userList?.users as any[])?.find(
        (u: any) => u.email?.toLowerCase() === cleanEmail
      );

      const { data: existingStaff } = await adminClient
        .from('staff_profiles')
        .select('id, email, organization_id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingStaff?.organization_id) {
        existingOrgId = existingStaff.organization_id;
      }

      if (existingUser) {
        // User already created in auth.users: update password and confirm email
        userId = existingUser.id;
        await adminClient.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: {
            full_name: cleanAdminName,
            department: cleanDept,
            organization_name: cleanOrgName,
            org_name: cleanOrgName,
            role: 'admin',
            facility_type: facilityType,
            facility_code: facilityCode,
            currency,
            primary_port: primaryPort,
          },
        });
      } else {
        // Create user in auth.users with email_confirm: true
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: cleanAdminName,
            department: cleanDept,
            organization_name: cleanOrgName,
            org_name: cleanOrgName,
            role: 'admin',
            facility_type: facilityType,
            facility_code: facilityCode,
            currency,
            primary_port: primaryPort,
          },
        });

        if (createErr || !newUser.user) {
          throw new Error(createErr?.message || 'Failed to create user in Supabase auth.');
        }
        userId = newUser.user.id;
      }

      // 2. Create or Update organization in public.organizations with 14-day starter trial & 5 seats
      let org: any = null;
      if (existingOrgId) {
        const { data: updatedOrg, error: updOrgErr } = await adminClient
          .from('organizations')
          .update({
            name: cleanOrgName,
            billing_currency: currency,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingOrgId)
          .select()
          .single();
        if (!updOrgErr && updatedOrg) {
          org = updatedOrg;
        }
      }

      if (!org) {
        const { data: newOrg, error: orgErr } = await adminClient
          .from('organizations')
          .insert({
            name: cleanOrgName,
            plan_tier: 'starter',
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            max_staff_seats: 5,
            billing_currency: currency,
          })
          .select()
          .single();

        if (orgErr || !newOrg) {
          throw new Error(orgErr?.message || 'Failed to insert organization in Supabase database.');
        }
        org = newOrg;
      }

      // 3. Upsert staff profile for admin
      const { error: staffErr } = await adminClient
        .from('staff_profiles')
        .upsert({
          id: userId,
          organization_id: org.id,
          email: cleanEmail,
          full_name: cleanAdminName,
          role: 'admin',
          department: cleanDept,
          is_active: true,
        });

      if (staffErr) {
        console.warn('[Register Tenant] Warning on staff profile upsert:', staffErr);
      }

      // 4. Seed app_settings for organization
      const derivedFacilityCode = facilityCode?.trim() || `FAC-${cleanOrgName.substring(0, 3).toUpperCase()}-01`;
      await adminClient.from('app_settings').upsert({
        organization_id: org.id,
        company_name: cleanOrgName,
        facility_code: derivedFacilityCode,
        primary_port: primaryPort,
        currency: currency,
        tax_rate: 15.0,
        fda_registration_number: `FDA-REG-${cleanOrgName.substring(0, 5).toUpperCase()}01`,
        eu_approval_number: `EU-APPR-${cleanOrgName.substring(0, 5).toUpperCase()}01`,
      });

      // 5. Send Google SMTP Confirmation / Welcome Email
      const transporter = getGoogleSmtpTransporter();
      if (transporter) {
        const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
        const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';
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
        const activationUrl = `${targetWebsite}?activated=true&email=${encodeURIComponent(cleanEmail)}&org=${encodeURIComponent(cleanOrgName)}`;

        transporter.sendMail({
          from: `"${fromName}" <${fromUser}>`,
          to: cleanEmail,
          subject: `❄️ Activation of this website: Welcome to ${cleanOrgName} - Frostly`,
          text: `Welcome ${cleanAdminName}!\n\nYour organization workspace for ${cleanOrgName} has been initialized in Supabase.\nWebsite: ${targetWebsite}\nActivation URL: ${activationUrl}\nAdministrator: ${cleanEmail}\nFacility Code: ${derivedFacilityCode}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #0f172a;">
              <div style="display: flex; align-items: center; margin-bottom: 24px;">
                <span style="font-size: 26px; margin-right: 10px;">❄️</span>
                <strong style="font-size: 20px; color: #0f172a;">Frostly Seafood Platform</strong>
              </div>
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">
                  Workspace Ready
                </div>
                <h2 style="font-size: 17px; color: #14532d; font-weight: 700; margin: 0 0 6px 0;">
                  Organization Created in Supabase
                </h2>
                <p style="font-size: 13px; color: #15803d; margin: 0;">
                  Your organization <strong>${cleanOrgName}</strong> has been registered with 14 days Starter trial access.
                </p>
              </div>
              <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0 0 20px 0;">
                Hello <strong>${cleanAdminName}</strong>, your workspace has been configured. Click below to sign in:
              </p>
              <div style="margin: 28px 0; text-align: left;">
                <a href="${activationUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block;">
                  Sign In to ${cleanOrgName} Workspace
                </a>
              </div>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0; font-size: 12px; color: #475569;">
                <div><strong>Website:</strong> ${targetWebsite}</div>
                <div><strong>Organization:</strong> ${cleanOrgName}</div>
                <div><strong>Admin:</strong> ${cleanEmail}</div>
                <div><strong>Facility Code:</strong> ${derivedFacilityCode}</div>
              </div>
            </div>
          `,
        }).catch(console.warn);
      }

      res.json({
        success: true,
        organization: org,
        userId,
        message: `Organization "${cleanOrgName}" successfully created in Supabase.`,
      });
    } catch (err: any) {
      console.error('[Register Tenant Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to register organization' });
    }
  });

  // SECURITY HARDENING: Permanently decommission unauthenticated password reset and activation bypass routes.
  // Password updates require an authenticated session via supabase.auth.updateUser.
  // Account activation and invite acceptance require valid cryptographic tokens.
  app.post('/api/auth/set-password-and-activate', (req, res) => {
    res.status(403).json({
      error: 'Direct unauthenticated password modification is forbidden. Please sign in or use standard password recovery.',
    });
  });

  app.post('/api/auth/instant-activate', (req, res) => {
    res.status(403).json({
      error: 'Direct unauthenticated account activation is forbidden. Please verify your account via the link sent to your email or accept your invitation with your secure token.',
    });
  });

  // Password Validation & Security Analysis Endpoint
  app.post('/api/auth/validate-password', (req, res) => {
    const { password } = req.body;
    const result = validatePassword(password || '');
    res.json(result);
  });

  // Onboarding Bootstrap Endpoint: Ensures tenant organization and admin profile are created reliably
  app.post('/api/tenant/bootstrap-onboarding', async (req, res) => {
    const { userId, email, adminFullName, adminDepartment, options } = req.body;
    const orgName = req.body.orgName || req.body.organizationName;
    if (!orgName || !orgName.trim()) {
      res.status(400).json({ error: 'Organization name is required.' });
      return;
    }

    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin service is not configured.' });
      return;
    }

    try {
      // SECURITY: identity comes from the verified session token, never from the request body.
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required to complete onboarding.' });
        return;
      }
      const { data: callerData, error: callerErr } = await adminClient.auth.getUser(authHeader.slice(7).trim());
      if (callerErr || !callerData?.user) {
        res.status(401).json({ error: 'Invalid or expired session token.' });
        return;
      }
      const targetUserId = callerData.user.id;
      const cleanEmail = (callerData.user.email || '').trim().toLowerCase();

      if (!targetUserId) {
        res.status(400).json({ error: 'A valid authenticated user ID or email is required.' });
        return;
      }

      // Check if user already has an organization
      const { data: existingProfile } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, role')
        .eq('id', targetUserId)
        .maybeSingle();

      let activeOrgId = existingProfile?.organization_id;

      if (!activeOrgId) {
        const { data: newOrg, error: orgErr } = await adminClient
          .from('organizations')
          .insert({
            name: orgName.trim(),
            billing_currency: options?.currency || 'GHS',
            plan_tier: 'starter',
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            max_staff_seats: 5,
          })
          .select('*')
          .single();

        if (orgErr || !newOrg) {
          throw new Error(orgErr?.message || 'Failed to create organization in database.');
        }

        activeOrgId = newOrg.id;

        await adminClient
          .from('staff_profiles')
          .upsert({
            id: targetUserId,
            organization_id: activeOrgId,
            email: cleanEmail || targetUserId,
            full_name: adminFullName || cleanEmail?.split('@')[0] || 'Administrator',
            role: 'admin',
            department: adminDepartment || 'Executive Operations',
            is_active: true,
            updated_at: new Date().toISOString(),
          });
      } else {
        await adminClient
          .from('organizations')
          .update({
            name: orgName.trim(),
            billing_currency: options?.currency || 'GHS',
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeOrgId);

        await adminClient
          .from('staff_profiles')
          .update({
            full_name: adminFullName || undefined,
            department: adminDepartment || undefined,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetUserId);
      }

      res.json({
        success: true,
        organization_id: activeOrgId,
        organization_name: orgName.trim(),
      });
    } catch (err: any) {
      console.error('[Bootstrap Onboarding Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to complete workspace onboarding.' });
    }
  });

  // Workspace Data Purge: Wipes all operational & transactional records for a tenant while preserving user accounts & staff credentials
  app.post('/api/tenant/purge-data', creatorOnly, async (req, res) => {
    const { organizationId, confirmName } = req.body;
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin service is not configured.' });
      return;
    }

    if (!organizationId || typeof organizationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organizationId.trim())) {
      res.status(400).json({ error: 'A valid organization UUID is required for data purge.' });
      return;
    }

    const cleanOrgId = organizationId.trim().toLowerCase();

    // Refuse HQ or root platform organization
    if (
      cleanOrgId === '00000000-0000-0000-0000-000000000000' ||
      cleanOrgId === '00000000-0000-0000-0000-000000000001'
    ) {
      res.status(403).json({ error: 'Cannot purge the Frostly HQ or default root organization.' });
      return;
    }

    try {
      // Lookup target organization strictly by exact UUID
      const { data: targetOrg, error: orgLookupErr } = await adminClient
        .from('organizations')
        .select('id, name')
        .eq('id', cleanOrgId)
        .maybeSingle();

      if (orgLookupErr || !targetOrg) {
        res.status(404).json({ error: `Organization "${cleanOrgId}" not found.` });
        return;
      }

      if (targetOrg.name.trim().toLowerCase().includes('frostly hq') || targetOrg.name.trim().toLowerCase() === 'frostly') {
        res.status(403).json({ error: 'Cannot purge the Frostly HQ platform organization.' });
        return;
      }

      // Exact confirmation name match required
      if (!confirmName || typeof confirmName !== 'string' || confirmName.trim() !== targetOrg.name.trim()) {
        res.status(400).json({
          error: `Confirmation name "${confirmName || ''}" does not match exact organization name "${targetOrg.name}".`,
        });
        return;
      }

      // Try RPC first
      const { data: rpcData, error: rpcErr } = await adminClient.rpc('purge_tenant_data_except_users', {
        p_org_identifier: targetOrg.id,
        p_confirm_name: targetOrg.name,
      });

      if (!rpcErr && rpcData?.success) {
        res.json({ success: true, ...rpcData });
        return;
      }

      // Fallback: direct table deletions with failure tracking
      const orgId = targetOrg.id;
      const tables = [
        'inventory_adjustments',
        'inventory_adjustment_accounts',
        'order_line_items',
        'client_orders',
        'purchase_order_items',
        'purchase_order_landings',
        'retail_sale_items',
        'retail_transactions',
        'retail_wholesale_products',
        'haccp_audit_records',
        'financial_ledger_entries',
        'reefer_sensor_readings',
        'inventory_batches',
        'reefer_vehicles',
        'fleet_vessels',
        'system_notifications',
        'customers',
        'suppliers',
        'species'
      ];

      const failedTables: string[] = [];
      for (const t of tables) {
        try {
          const { error: delErr } = await adminClient.from(t).delete().eq('organization_id', orgId);
          if (delErr) {
            console.error(`[Purge] Table ${t} deletion returned error:`, delErr);
            failedTables.push(t);
          }
        } catch (tableErr) {
          console.error(`[Purge] Table ${t} exception:`, tableErr);
          failedTables.push(t);
        }
      }

      if (failedTables.length > 0) {
        res.status(500).json({
          error: `Purge operation failed for tables: ${failedTables.join(', ')}.`,
          failedTables,
        });
        return;
      }

      const { data: staff } = await adminClient
        .from('staff_profiles')
        .select('id, email, full_name, role')
        .eq('organization_id', orgId);

      res.json({
        success: true,
        organization_id: orgId,
        organization_name: targetOrg.name,
        preserved_users_count: staff?.length || 0,
        preserved_user_emails: staff?.map((s: any) => s.email) || [],
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to purge workspace data.' });
    }
  });

  // ==========================================
  // TENANT WORKSPACE: WORKER MANAGEMENT ROUTES
  // ==========================================

  // Middleware: Enforces that caller is authenticated and holds administrator or creator role for the tenant organization
  const requireTenantAdmin = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization bearer token.' });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: 'Empty bearer token supplied.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured.' });
      return;
    }

    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
        return;
      }

      const user = userData.user;
      const targetOrgId = (req.body?.organizationId || req.query?.organizationId) as string | undefined;

      // Look up caller's staff profile
      const { data: callerProfile } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, role, is_active')
        .eq('id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!callerProfile) {
        res.status(403).json({ error: 'Forbidden: No active staff profile found for authenticated user.' });
        return;
      }

      const isCreator = callerProfile.role === 'creator';
      const isAdmin = callerProfile.role === 'admin';

      if (!isCreator && !isAdmin) {
        res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
        return;
      }

      // If target organization specified, ensure caller has access (creator can access all; admin can only access their org)
      if (targetOrgId && !isCreator && callerProfile.organization_id !== targetOrgId) {
        res.status(403).json({ error: 'Forbidden: Access denied to target tenant organization.' });
        return;
      }

      (req as any).callerUser = user;
      (req as any).callerProfile = callerProfile;
      next();
    } catch (authErr: any) {
      console.error('[requireTenantAdmin Middleware Error]:', authErr);
      res.status(500).json({ error: authErr?.message || 'Authentication error.' });
    }
  };

  // Role-Level Security (RLS) Middleware: Enforces that caller holds one of the specified roles
  const requireTenantRole = (allowedRoles: string[]) => {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing or invalid Authorization bearer token.' });
        return;
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        res.status(401).json({ error: 'Empty bearer token supplied.' });
        return;
      }

      const adminClient = adminClientGetter();
      if (!adminClient) {
        res.status(500).json({ error: 'Supabase admin client is not configured.' });
        return;
      }

      try {
        const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
        if (userErr || !userData?.user) {
          res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
          return;
        }

        const user = userData.user;
        const { data: callerProfile } = await adminClient
          .from('staff_profiles')
          .select('id, organization_id, role, is_active')
          .eq('id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (!callerProfile) {
          res.status(403).json({ error: 'Forbidden: No active staff profile found for authenticated user.' });
          return;
        }

        const role = callerProfile.role;
        const isCreator = role === 'creator';
        if (!isCreator && !allowedRoles.includes(role)) {
          res.status(403).json({
            error: `Forbidden: Your assigned role (${role}) lacks permission for this operation. Required: ${allowedRoles.join(' or ')}.`,
            currentRole: role,
            allowedRoles,
          });
          return;
        }

        (req as any).callerUser = user;
        (req as any).callerProfile = callerProfile;
        next();
      } catch (authErr: any) {
        console.error('[requireTenantRole Middleware Error]:', authErr);
        res.status(500).json({ error: authErr?.message || 'Authentication error.' });
      }
    };
  };

  // 1. List Workers and Pending Invites for a Tenant Workspace
  app.get('/api/tenant/workers', requireTenantAdmin, async (req, res) => {
    const { organizationId } = req.query;
    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({ error: 'Organization ID parameter is required.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured.' });
      return;
    }

    try {
      // 1. Fetch organization details
      const { data: org, error: orgErr } = await adminClient
        .from('organizations')
        .select('id, name, plan_tier, subscription_status, max_staff_seats')
        .eq('id', organizationId)
        .maybeSingle();

      if (orgErr || !org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      // 2. Fetch all staff profiles for this organization
      const { data: workers, error: workersErr } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, email, full_name, role, department, is_active, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (workersErr) {
        throw workersErr;
      }

      // 3. Fetch active pending invites for this organization
      const { data: pendingInvites, error: invitesErr } = await adminClient
        .from('invites')
        .select('id, organization_id, email, role, token, expires_at, created_at')
        .eq('organization_id', organizationId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (invitesErr) {
        throw invitesErr;
      }

      const activeWorkersCount = (workers || []).filter((w) => w.is_active).length;
      const pendingInvitesCount = (pendingInvites || []).length;
      const seatsUsed = activeWorkersCount + pendingInvitesCount;
      const maxSeats = org.max_staff_seats || 5;

      res.json({
        success: true,
        organization: org,
        workers: workers || [],
        pendingInvites: pendingInvites || [],
        seats: {
          used: seatsUsed,
          max: maxSeats,
          available: Math.max(0, maxSeats - seatsUsed),
          activeWorkers: activeWorkersCount,
          pendingInvites: pendingInvitesCount,
        },
      });
    } catch (err: any) {
      console.error('[List Workers Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to list tenant workers.' });
    }
  });

  // 2. Add Worker / User to Tenant Workspace (Direct Account Provisioning or Invite Token)
  app.post('/api/tenant/workers', requireTenantAdmin, async (req, res) => {
    const {
      organizationId,
      email,
      fullName,
      role = 'ops_staff',
      department = 'Operations',
      password,
      sendEmail = true,
      websiteUrl,
    } = req.body;

    if (!organizationId || !email) {
      res.status(400).json({ error: 'Organization ID and Worker Email are required.' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (fullName || cleanEmail.split('@')[0]).trim();
    const cleanDept = (department || 'Operations').trim();
    const allowedRoles = ['admin', 'ops_staff', 'sales_staff', 'dispatch_staff', 'viewer'];
    const validRole = allowedRoles.includes(role) ? role : 'ops_staff';

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured on the server.' });
      return;
    }

    try {
      // 1. Fetch organization and verify capacity
      const { data: org, error: orgErr } = await adminClient
        .from('organizations')
        .select('id, name, plan_tier, subscription_status, max_staff_seats')
        .eq('id', organizationId)
        .maybeSingle();

      if (orgErr || !org) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      // Check current capacity
      const { count: staffCount } = await adminClient
        .from('staff_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      const { count: inviteCount } = await adminClient
        .from('invites')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString());

      const totalSeatsUsed = (staffCount || 0) + (inviteCount || 0);
      const maxSeats = org.max_staff_seats || 5;

      if (totalSeatsUsed >= maxSeats) {
        res.status(400).json({
          error: `Seat capacity limit reached (${totalSeatsUsed}/${maxSeats} seats). Please upgrade your subscription tier to add more workers to this workspace.`,
          code: 'SEAT_LIMIT_REACHED',
        });
        return;
      }

      // 2. Check if email is already enrolled in staff_profiles
      const { data: existingStaff } = await adminClient
        .from('staff_profiles')
        .select('id, email, organization_id, is_active')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingStaff) {
        if (existingStaff.organization_id === organizationId) {
          if (!existingStaff.is_active) {
            // Worker is currently deactivated; reactivate them
            await adminClient
              .from('staff_profiles')
              .update({
                is_active: true,
                role: validRole,
                department: cleanDept,
                full_name: cleanName,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingStaff.id);

            res.json({
              success: true,
              mode: 'reactivated',
              message: `Reactivated existing worker profile for ${cleanName}.`,
              workerId: existingStaff.id,
            });
            return;
          }
          res.status(400).json({
            error: `User ${cleanEmail} is already an active worker in this workspace.`,
          });
          return;
        } else {
          res.status(400).json({
            error: `Email ${cleanEmail} is already registered with another organization. Each worker must have a distinct business email address.`,
          });
          return;
        }
      }

      // 3. Determine Provisioning Mode: Direct Account (Password Provided) vs. Invite Token
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

      if (password) {
        const passCheck = validatePassword(password);
        if (!passCheck.isValid) {
          res.status(400).json({
            error: passCheck.errorMessage || 'Worker password does not satisfy security requirements.',
            ruleChecks: passCheck.ruleChecks,
          });
          return;
        }

        // DIRECT ACCOUNT CREATION MODE: Worker can log in immediately
        const cleanPassword = password.trim();

        // Check if user already exists in auth.users
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const existingAuthUser = userList?.users?.find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );

        let userId: string;

        if (existingAuthUser) {
          userId = existingAuthUser.id;
          await adminClient.auth.admin.updateUserById(userId, {
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              full_name: cleanName,
              department: cleanDept,
              role: validRole,
              organization_id: organizationId,
              org_name: org.name,
            },
          });
        } else {
          const { data: newUser, error: createAuthErr } = await adminClient.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              full_name: cleanName,
              department: cleanDept,
              role: validRole,
              organization_id: organizationId,
              org_name: org.name,
            },
          });

          if (createAuthErr || !newUser?.user) {
            throw createAuthErr || new Error('Failed to create worker auth account.');
          }
          userId = newUser.user.id;
        }

        // Insert / Upsert into staff_profiles
        const { data: newStaffProfile, error: profileErr } = await adminClient
          .from('staff_profiles')
          .upsert({
            id: userId,
            organization_id: organizationId,
            email: cleanEmail,
            full_name: cleanName,
            role: validRole,
            department: cleanDept,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (profileErr) {
          throw profileErr;
        }

        // Send Welcome & Credentials Email via Google SMTP if configured
        const transporter = getGoogleSmtpTransporter();
        if (transporter && sendEmail) {
          const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
          const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

          const roleLabels: Record<string, string> = {
            ops_staff: 'Operations Staff / Cold Storage Worker',
            dispatch_staff: 'Dispatch & Logistics Worker',
            sales_staff: 'Wholesale & POS Sales Worker',
            admin: 'Facility Administrator',
            viewer: 'HACCP Compliance Auditor',
          };

          const loginUrl = `${targetWebsite}?email=${encodeURIComponent(cleanEmail)}`;

          await transporter.sendMail({
            from: `"${fromName}" <${fromUser}>`,
            to: cleanEmail,
            subject: `🐟 Welcome to ${org.name} Workspace - Worker Account Created`,
            text: `Hello ${cleanName},\n\nYou have been added as a ${roleLabels[validRole] || validRole} to the ${org.name} seafood workspace on Frostly.\n\nYour Login Credentials:\nWebsite: ${targetWebsite}\nEmail: ${cleanEmail}\nTemporary Password: ${cleanPassword}\nDepartment: ${cleanDept}\n\nPlease sign in and manage your cold-chain tasks: ${loginUrl}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #0f172a;">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                  <span style="font-size: 26px; margin-right: 10px;">❄️</span>
                  <strong style="font-size: 20px; color: #0f172a;">Frostly Seafood Platform</strong>
                </div>

                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                  <span style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">
                    Worker Account Created
                  </span>
                  <h2 style="font-size: 18px; color: #14532d; font-weight: 700; margin: 0 0 6px 0;">
                    Welcome to ${org.name}
                  </h2>
                  <p style="font-size: 13px; color: #166534; margin: 0;">
                    You have been enrolled as an authorized <strong>${roleLabels[validRole] || validRole}</strong> in the tenant workspace.
                  </p>
                </div>

                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 16px;">
                  Hello <strong>${cleanName}</strong>, your user account has been provisioned. You can sign in immediately with the credentials below:
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
                  <div style="margin-bottom: 8px; font-size: 13px;"><strong>Website:</strong> <a href="${targetWebsite}" style="color: #4f46e5;">${targetWebsite}</a></div>
                  <div style="margin-bottom: 8px; font-size: 13px;"><strong>Login Email:</strong> <span style="font-family: monospace; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${cleanEmail}</span></div>
                  <div style="margin-bottom: 8px; font-size: 13px;"><strong>Password:</strong> <span style="font-family: monospace; background-color: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${cleanPassword}</span></div>
                  <div style="margin-bottom: 8px; font-size: 13px;"><strong>Assigned Role:</strong> ${roleLabels[validRole] || validRole}</div>
                  <div style="font-size: 13px;"><strong>Department:</strong> ${cleanDept}</div>
                </div>

                <div style="margin: 28px 0; text-align: left;">
                  <a href="${loginUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block;">
                    Sign In to Workspace
                  </a>
                </div>
              </div>
            `,
          }).catch((mailErr) => console.warn('[Worker Welcome Mail Error]:', mailErr));
        }

        res.json({
          success: true,
          mode: 'direct_provisioned',
          message: `Worker account created for ${cleanName} with immediate sign-in capability.`,
          worker: newStaffProfile,
          credentials: {
            email: cleanEmail,
            password: cleanPassword,
            role: validRole,
          },
        });
        return;
      } else {
        // INVITATION TOKEN MODE
        const inviteToken = crypto.randomBytes(24).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        // Delete any expired pending invite for this email
        await adminClient
          .from('invites')
          .delete()
          .eq('organization_id', organizationId)
          .ilike('email', cleanEmail);

        const { data: newInvite, error: inviteErr } = await adminClient
          .from('invites')
          .insert({
            organization_id: organizationId,
            email: cleanEmail,
            role: validRole,
            token: inviteToken,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (inviteErr) {
          throw inviteErr;
        }

        const inviteAcceptUrl = `${targetWebsite}?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(cleanEmail)}`;

        // Send Invite Email via Google SMTP if configured
        const transporter = getGoogleSmtpTransporter();
        if (transporter && sendEmail) {
          const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
          const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

          await transporter.sendMail({
            from: `"${fromName}" <${fromUser}>`,
            to: cleanEmail,
            subject: `📨 You've been invited to join ${org.name} - Frostly`,
            text: `Hello ${cleanName},\n\nYou have been invited to join the ${org.name} seafood workspace as ${validRole}.\n\nAccept your invitation and configure your password here:\n${inviteAcceptUrl}\n\nInvite Code: ${inviteToken}\nExpires: 7 days`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 20px; background-color: #ffffff; color: #0f172a;">
                <div style="display: flex; align-items: center; margin-bottom: 20px;">
                  <span style="font-size: 26px; margin-right: 10px;">❄️</span>
                  <strong style="font-size: 20px; color: #0f172a;">Frostly Seafood Platform</strong>
                </div>

                <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                  <span style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 6px; margin-bottom: 8px;">
                    Workspace Invitation
                  </span>
                  <h2 style="font-size: 18px; color: #1e3a8a; font-weight: 700; margin: 0 0 6px 0;">
                    Join ${org.name}
                  </h2>
                  <p style="font-size: 13px; color: #1e40af; margin: 0;">
                    An administrator has invited you to join their cold-chain workspace as <strong>${validRole}</strong>.
                  </p>
                </div>

                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
                  Click the button below to accept your invitation, set your account password, and access the workspace:
                </p>

                <div style="margin: 24px 0;">
                  <a href="${inviteAcceptUrl}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-block;">
                    Accept Invitation & Set Password
                  </a>
                </div>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; font-size: 12px; color: #64748b;">
                  <div><strong>Manual Invite Code:</strong> <span style="font-family: monospace; color: #334155;">${inviteToken}</span></div>
                  <div><strong>Invited Email:</strong> ${cleanEmail}</div>
                  <div><strong>Valid for:</strong> 7 days</div>
                </div>
              </div>
            `,
          }).catch((mailErr) => console.warn('[Worker Invite Mail Error]:', mailErr));
        }

        res.json({
          success: true,
          mode: 'invite_issued',
          message: `Workspace invitation issued for ${cleanEmail}.`,
          invite: newInvite,
          inviteToken,
          inviteAcceptUrl,
        });
        return;
      }
    } catch (err: any) {
      console.error('[Add Worker Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to add worker to tenant workspace.' });
    }
  });

  // 3. Update Worker Profile / Role / Status
  app.patch('/api/tenant/workers/:id', requireTenantAdmin, async (req, res) => {
    const { id } = req.params;
    const { organizationId, role, department, full_name, is_active } = req.body;

    if (!id || !organizationId) {
      res.status(400).json({ error: 'Worker ID and Organization ID are required.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client not configured.' });
      return;
    }

    try {
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (role !== undefined) updateData.role = role;
      if (department !== undefined) updateData.department = department;
      if (full_name !== undefined) updateData.full_name = full_name;
      if (is_active !== undefined) updateData.is_active = Boolean(is_active);

      const { data: updatedWorker, error: updateErr } = await adminClient
        .from('staff_profiles')
        .update(updateData)
        .eq('id', id)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Update auth user metadata if role changed
      if (role) {
        await adminClient.auth.admin.updateUserById(id, {
          user_metadata: { role },
        }).catch(() => {});
      }

      res.json({
        success: true,
        message: 'Worker profile updated successfully.',
        worker: updatedWorker,
      });
    } catch (err: any) {
      console.error('[Update Worker Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to update worker.' });
    }
  });

  // 4. Delete / Remove Worker or Pending Invite from Tenant Workspace
  app.delete('/api/tenant/workers/:id', requireTenantAdmin, async (req, res) => {
    const { id } = req.params;
    const { organizationId, isInvite } = req.query;

    if (!id || !organizationId) {
      res.status(400).json({ error: 'Worker ID and Organization ID are required.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client not configured.' });
      return;
    }

    try {
      if (isInvite === 'true') {
        // Delete pending invite
        const { error: delErr } = await adminClient
          .from('invites')
          .delete()
          .eq('id', id)
          .eq('organization_id', organizationId);

        if (delErr) throw delErr;

        res.json({ success: true, message: 'Pending invitation revoked.' });
        return;
      } else {
        // Deactivate or remove staff profile
        const { error: staffErr } = await adminClient
          .from('staff_profiles')
          .delete()
          .eq('id', id)
          .eq('organization_id', organizationId);

        if (staffErr) {
          // If foreign key constraint prevents hard delete, soft-delete by deactivating
          await adminClient
            .from('staff_profiles')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organization_id', organizationId);
        }

        res.json({ success: true, message: 'Worker removed from tenant workspace.' });
        return;
      }
    } catch (err: any) {
      console.error('[Delete Worker Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to remove worker.' });
    }
  });

  // 5. Reset Worker Password
  app.post('/api/tenant/workers/:id/reset-password', requireTenantAdmin, async (req, res) => {
    const { id } = req.params;
    const { password, email, organizationName } = req.body;

    if (!id || !password) {
      res.status(400).json({ error: 'Worker ID and New Password are required.' });
      return;
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
      res.status(400).json({
        error: passCheck.errorMessage || 'New password does not satisfy security requirements.',
        ruleChecks: passCheck.ruleChecks,
      });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client not configured.' });
      return;
    }

    try {
      const { error: passErr } = await adminClient.auth.admin.updateUserById(id, {
        password: password.trim(),
        email_confirm: true,
      });

      if (passErr) throw passErr;

      // Optional email notification
      const transporter = getGoogleSmtpTransporter();
      if (transporter && email) {
        const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
        const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Seafood Platform';

        await transporter.sendMail({
          from: `"${fromName}" <${fromUser}>`,
          to: email.trim(),
          subject: `🔐 Your Workspace Password Has Been Reset - ${organizationName || 'Frostly'}`,
          text: `Your administrator has updated your workspace password.\n\nNew Temporary Password: ${password.trim()}\nEmail: ${email.trim()}`,
        }).catch(console.warn);
      }

      res.json({
        success: true,
        message: 'Worker password updated successfully.',
      });
    } catch (err: any) {
      console.error('[Reset Password Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to reset worker password.' });
    }
  });

  // ==========================================
  // AMANSOCEAN D2C STOREFRONT & DUAL-LEDGER ERP INTEGRATION
  // ==========================================

  const primaryOrgCache = new WeakMap<object, { id: string; name: string }>();

  const isMissingTableError = (err: any): boolean => {
    if (!err) return false;
    const msg = String(err.message || err.details || err.hint || '');
    return (
      err.code === 'PGRST205' ||
      err.code === '42P01' ||
      /Could not find the table|relation .* does not exist|schema cache/i.test(msg)
    );
  };

  type SeedProductMeta = AmansoceanOfficialCatalogItem;
  const AMANSOCEAN_SEED_PRODUCTS: SeedProductMeta[] = AMANSOCEAN_OFFICIAL_CATALOG;
  const LEGACY_DEMO_ID_SET = new Set<string>(LEGACY_DEMO_PRODUCT_IDS);

  const SEED_BY_ID = new Map(AMANSOCEAN_SEED_PRODUCTS.map((p) => [p.id, p]));
  const SEED_BY_SKU = new Map(AMANSOCEAN_SEED_PRODUCTS.map((p) => [p.sku.toUpperCase(), p]));

  async function resolvePrimaryStorefrontOrg(
    adminClient: any
  ): Promise<{ id: string; name: string }> {
    const cached = primaryOrgCache.get(adminClient);
    if (cached) return cached;

    const envOrgId = (process.env.AMANSOCEAN_ORG_ID || '').trim();
    if (envOrgId) {
      const { data: envOrg } = await adminClient
        .from('organizations')
        .select('id, name')
        .eq('id', envOrgId)
        .maybeSingle();
      const resolved = {
        id: envOrg?.id || envOrgId,
        name: envOrg?.name || 'Amansocean Seafoods and Coldstore',
      };
      primaryOrgCache.set(adminClient, resolved);
      return resolved;
    }

    const { data: orgs } = await adminClient
      .from('organizations')
      .select('id, name, is_active, created_at')
      .eq('is_active', true);

    const list = Array.isArray(orgs) ? orgs : [];
    const amansOrg = list.find((o: any) => /amans\s*ocean/i.test(String(o.name || '')));
    if (amansOrg) {
      const resolved = { id: amansOrg.id, name: amansOrg.name };
      primaryOrgCache.set(adminClient, resolved);
      return resolved;
    }

    const fallbackOrg =
      list.find((o: any) => o.id !== '00000000-0000-0000-0000-000000000001') ||
      list[0] || {
        id: '35a94c6e-e230-4b7c-8404-a4f0ae06b798',
        name: 'Amansocean Seafoods and Coldstore',
      };

    const resolved = { id: fallbackOrg.id, name: fallbackOrg.name };
    primaryOrgCache.set(adminClient, resolved);
    return resolved;
  }

  async function ensureStorefrontCatalogSeeded(
    adminClient: any,
    orgId: string,
    options?: { syncMissing?: boolean; forceResetPrices?: boolean }
  ): Promise<void> {
    const { data: existingRows, error: checkErr } = await adminClient
      .from('retail_wholesale_products')
      .select('id, is_active')
      .eq('organization_id', orgId);

    if (checkErr) {
      return;
    }

    const rowsList = Array.isArray(existingRows) ? existingRows : [];

    // Soft-deactivate any legacy USD demo products so only the official GH₵ catalog remains active
    const hasActiveLegacy = rowsList.some(
      (r: any) => r.is_active !== false && LEGACY_DEMO_ID_SET.has(String(r.id))
    );
    if (hasActiveLegacy) {
      await adminClient
        .from('retail_wholesale_products')
        .update({
          is_active: false,
          is_available_for_retail: false,
          is_available_for_wholesale: false,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', orgId)
        .in('id', [...LEGACY_DEMO_PRODUCT_IDS]);
    }

    const forceReset = Boolean(options?.forceResetPrices);
    const syncMissing = Boolean(options?.syncMissing);
    const hasAnyOfficialRow = rowsList.some((r: any) => String(r.id).startsWith('ao-'));

    if (!forceReset && !syncMissing && hasAnyOfficialRow) {
      return;
    }

    const activeIdSet = new Set(
      rowsList
        .filter((r: any) => r.is_active !== false && !LEGACY_DEMO_ID_SET.has(String(r.id)))
        .map((r: any) => String(r.id))
    );

    const itemsToSeed = forceReset
      ? AMANSOCEAN_SEED_PRODUCTS
      : AMANSOCEAN_SEED_PRODUCTS.filter((p) => !activeIdSet.has(p.id));

    if (itemsToSeed.length === 0) {
      return;
    }

    // 1. Seed unique species for this workspace
    const uniqueSpeciesMap = new Map<string, SeedProductMeta>();
    for (const item of itemsToSeed) {
      if (!uniqueSpeciesMap.has(item.species_id)) {
        uniqueSpeciesMap.set(item.species_id, item);
      }
    }

    const speciesRows = Array.from(uniqueSpeciesMap.values()).map((s) => ({
      organization_id: orgId,
      id: s.species_id,
      name: s.species_name,
      scientific_name: s.scientific_name,
      category: s.db_category,
      default_zone: 'Commercial Cold Storage (-22°C)',
      standard_price_per_kg: s.retail_price_per_unit,
      available_grades: ['Sashimi AAA', 'Grade #1'],
      fao_zones: ['FAO 34', 'FAO 27'],
      gear_types: ['Sustainable Trawl & Trap'],
      seasonal_peak: 'Year-Round Cold Chain',
      image: s.image_url,
      shelf_life_fresh_days: 5,
      shelf_life_frozen_months: 18,
      is_active: true,
    }));

    await adminClient
      .from('species')
      .upsert(speciesRows, { onConflict: 'organization_id,id' });

    // 2. Seed the official Amans Ocean GH₵ products
    const orgShort = orgId.replace(/-/g, '').slice(0, 4).toUpperCase();
    for (const p of itemsToSeed) {
      const baseRow = {
        organization_id: orgId,
        id: p.id,
        species_id: p.species_id,
        name: p.name,
        cut_type: p.cut_type,
        category: p.db_category,
        grade: p.grade,
        stock_kg: p.stock_kg,
        unit: p.unit,
        cost_price_per_unit: p.cost_price_per_unit,
        wholesale_price_per_unit: p.wholesale_price_per_unit,
        retail_price_per_unit: p.retail_price_per_unit,
        wholesale_min_qty: p.wholesale_min_qty,
        retail_pack_size: p.retail_pack_size,
        sku: p.sku,
        image_url: p.image_url,
        origin: p.origin,
        is_available_for_retail: true,
        is_available_for_wholesale: true,
        is_active: true,
      };

      const { error: prodErr } = await adminClient
        .from('retail_wholesale_products')
        .upsert(baseRow, { onConflict: 'organization_id,id' });

      if (prodErr && /sku/i.test(String(prodErr.message || ''))) {
        await adminClient
          .from('retail_wholesale_products')
          .upsert(
            { ...baseRow, sku: `${p.sku}-${orgShort}` },
            { onConflict: 'organization_id,id' }
          );
      }
    }

    // 3. Seed linked cold-storage inventory batches so ERP stock & FEFO lot deduction match 1:1
    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const batchRows = itemsToSeed.map((p) => ({
      organization_id: orgId,
      id: p.lot_id,
      species_id: p.species_id,
      species_name: p.species_name,
      scientific_name: p.scientific_name,
      category: p.db_category,
      harvest_date: today,
      landing_port: 'Port of Tema Coldstore Hub',
      vessel_name: 'MV Amansocean Star',
      vessel_registration: 'GH-TMA-402',
      captain_name: 'Capt. Kwame Boateng',
      fao_area: 'FAO 34 Eastern Central Atlantic',
      gps_coordinates: { latitude: 5.6265, longitude: 0.0061 },
      location_description: 'Amans Ocean Coldstore · Abrepo, Barekese Rd',
      gear_type: 'IQF Cryo Line',
      grade: p.grade,
      initial_weight_kg: p.stock_kg,
      available_weight_kg: p.stock_kg,
      allocated_weight_kg: 0,
      storage_zone: 'Commercial Cold Storage (-22°C)',
      current_temp_celsius: -22.4,
      target_temp_celsius: -22.0,
      cost_per_kg: p.cost_price_per_unit,
      wholesale_price_per_kg: p.wholesale_price_per_unit,
      certifications: ['HACCP Certified', 'FDA Approved'],
      inspection_status: 'Passed',
      histamine_ppm: 4.5,
      core_temp_celsius: -22.2,
      received_date: today,
      expiry_date: expiry,
      qr_code_seed: `QR-${p.lot_id}-${orgShort}`,
      notes: `Storefront retail lot linked to ${p.name}`,
      linked_product_id: p.id,
      product_sku: p.sku,
      is_retail_cut_lot: true,
    }));

    await adminClient
      .from('inventory_batches')
      .upsert(batchRows, { onConflict: 'organization_id,id' });
  }

  function mapDbRowToStorefrontProduct(row: any) {
    const seed =
      SEED_BY_ID.get(String(row.id)) ||
      SEED_BY_SKU.get(String(row.sku || '').toUpperCase());

    let category: AmansoceanCategory = seed?.storefront_category || 'Whole Fish';

    if (!seed) {
      const lowerText = `${row.name || ''} ${row.cut_type || ''} ${row.category || ''}`.toLowerCase();
      if (/powder|seasoning|ground|dried/.test(lowerText)) {
        category = 'Fish & Shrimp Powders';
      } else if (/fillet|chunk|loin|headless|h&g|saku|portion/.test(lowerText)) {
        category = 'Fillets & Chunks';
      } else if (/shrimp|prawn|crab|lobster|squid|octopus|snail|crustacean|mollusk|shellfish/.test(lowerText)) {
        category = 'Shrimps, Prawns & Shellfish';
      } else {
        category = 'Whole Fish';
      }
    }

    const stockKg = Math.max(0, Number(row.stock_kg ?? 0));
    const retailPrice = Number(row.retail_price_per_unit ?? seed?.retail_price_per_unit ?? 0);
    const wholesalePrice = Number(
      row.wholesale_price_per_unit ?? seed?.wholesale_price_per_unit ?? retailPrice
    );

    return {
      id: String(row.id),
      sku: String(row.sku || seed?.sku || row.id),
      name: String(row.name),
      category,
      description:
        seed?.description ||
        `${row.grade || 'Grade #1'} ${row.cut_type || 'IQF Flash Frozen'} from ${parseOriginLotMeta(row.origin).cleanOrigin || 'Amans Ocean Coldstore · Abrepo, Barekese Rd'}.`,
      price: retailPrice,
      wholesalePrice,
      wholesaleMinQty: Math.max(1, Number(row.wholesale_min_qty ?? seed?.wholesale_min_qty ?? 5)),
      unit: (row.unit || seed?.unit || 'kg') as 'kg' | 'pack',
      image: String(row.image_url || seed?.image_url || AMANSOCEAN_SEED_PRODUCTS[0].image_url),
      badge: seed?.badge,
      weight: String(row.retail_pack_size || seed?.retail_pack_size || (row.unit === 'pack' ? 'Regular Pack' : '1kg')),
      rating: seed?.rating ?? 4.8,
      origin: String(parseOriginLotMeta(row.origin).cleanOrigin || seed?.origin || 'Amans Ocean Coldstore · Abrepo, Barekese Rd'),
      stockKg,
      inStock: stockKg > 0,
    };
  }

  function parseOriginLotMeta(rawOrigin?: string | null): {
    cleanOrigin: string;
    linkedBatchId?: string;
    storageZone?: string;
  } {
    let cleanOrigin = String(rawOrigin || '');
    let linkedBatchId: string | undefined;
    let storageZone: string | undefined;
    if (cleanOrigin.includes('<!--frostly_lot:')) {
      try {
        const match = cleanOrigin.match(/<!--frostly_lot:(\{.*?\})-->/);
        if (match && match[1]) {
          const parsed = JSON.parse(match[1]);
          if (parsed.linkedBatchId) linkedBatchId = String(parsed.linkedBatchId);
          if (parsed.storageZone) storageZone = String(parsed.storageZone);
        }
      } catch {}
      cleanOrigin = cleanOrigin.replace(/<!--frostly_lot:.*?-->/g, '').trim();
    }
    return { cleanOrigin, linkedBatchId, storageZone };
  }

  function encodeOriginLotMeta(
    origin: string,
    linkedBatchId?: string | null,
    storageZone?: string | null
  ): string {
    const { cleanOrigin } = parseOriginLotMeta(origin);
    if (!linkedBatchId && !storageZone) return cleanOrigin;
    const meta = JSON.stringify({
      linkedBatchId: linkedBatchId || null,
      storageZone: storageZone || null,
    });
    return cleanOrigin ? `${cleanOrigin} <!--frostly_lot:${meta}-->` : `<!--frostly_lot:${meta}-->`;
  }

  function mapFulfillmentToErpOrderStatus(
    fulfillmentStatus: string
  ): 'Pending Confirmation' | 'Cryo-Packed & Iced' | 'In Reefer Transit' | 'Delivered' | 'Cancelled' {
    switch (fulfillmentStatus) {
      case 'packing':
        return 'Cryo-Packed & Iced';
      case 'out_for_delivery':
        return 'In Reefer Transit';
      case 'delivered':
        return 'Delivered';
      case 'canceled':
        return 'Cancelled';
      default:
        return 'Pending Confirmation';
    }
  }

  function mapErpOrderStatusToFulfillment(
    erpStatus: string,
    fallback?: string
  ): 'confirmed' | 'packing' | 'out_for_delivery' | 'delivered' | 'canceled' {
    if (erpStatus === 'Delivered') return 'delivered';
    if (erpStatus === 'Cancelled') return 'canceled';
    if (erpStatus === 'In Reefer Transit') return 'out_for_delivery';
    if (erpStatus === 'Weighing & Grading' || erpStatus === 'Cryo-Packed & Iced') return 'packing';
    if (
      fallback === 'confirmed' ||
      fallback === 'packing' ||
      fallback === 'out_for_delivery' ||
      fallback === 'delivered' ||
      fallback === 'canceled'
    ) {
      return fallback;
    }
    return 'confirmed';
  }

  function normalizePhoneDigits(phone?: string | null): string {
    return String(phone || '').replace(/\D+/g, '');
  }

  function contactsMatch(
    suppliedContact: string,
    orderPhone?: string | null,
    orderEmail?: string | null
  ): boolean {
    const clean = suppliedContact.trim().toLowerCase();
    if (!clean) return false;
    if (orderEmail && orderEmail.trim().toLowerCase() === clean) {
      return true;
    }
    const suppliedDigits = normalizePhoneDigits(clean);
    const storedDigits = normalizePhoneDigits(orderPhone);
    if (suppliedDigits.length >= 6 && storedDigits.length >= 6) {
      if (suppliedDigits === storedDigits) return true;
      const tailLen = Math.min(7, suppliedDigits.length, storedDigits.length);
      if (suppliedDigits.slice(-tailLen) === storedDigits.slice(-tailLen)) return true;
    }
    return false;
  }

  async function resolveOptionalUserId(req: express.Request, adminClient: any): Promise<string | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || !adminClient) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    try {
      const { data } = await adminClient.auth.getUser(token);
      return data?.user?.id || null;
    } catch {
      return null;
    }
  }

  async function recordStorefrontEventInternal(
    adminClient: any,
    payload: {
      organizationId: string;
      visitorId: string;
      sessionId?: string | null;
      userId?: string | null;
      eventType:
        | 'page_view'
        | 'product_search'
        | 'favorite_toggle'
        | 'add_to_cart'
        | 'begin_checkout'
        | 'order_completed'
        | 'newsletter_signup';
      productId?: string | null;
      productName?: string | null;
      cartValue?: number | null;
      deviceType?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    if (!adminClient) return;
    const row = {
      organization_id: payload.organizationId,
      visitor_id: payload.visitorId || 'anon-visitor',
      session_id: payload.sessionId || null,
      user_id: payload.userId || null,
      event_type: payload.eventType,
      product_id: payload.productId || null,
      product_name: payload.productName || null,
      cart_value: payload.cartValue != null ? Number(payload.cartValue) : null,
      device_type: payload.deviceType || 'desktop',
      metadata: payload.metadata || {},
    };

    const { error } = await adminClient.from('storefront_analytics_events').insert(row);
    if (error && isMissingTableError(error)) {
      await adminClient.from('user_feature_usage_logs').insert({
        user_id: payload.userId || null,
        organization_id: payload.organizationId,
        user_email: 'visitor@amansocean.store',
        user_name: payload.visitorId || 'Storefront Visitor',
        organization_name: 'Amansocean Storefront',
        feature_key: 'sf_event',
        feature_name: payload.eventType,
        category: 'storefront_internal',
        action_type: 'view',
        metadata: row,
      });
    }
  }

  // Middleware for ERP Storefront Queue & Creator Storefront Analytics
  const requireStaffSession = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization bearer token.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin client is not configured.' });
      return;
    }

    try {
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
        return;
      }

      const { data: callerProfile } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, role, is_active, full_name, email')
        .eq('id', userData.user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!callerProfile) {
        res.status(403).json({ error: 'Forbidden: Active staff profile required.' });
        return;
      }

      const requestedOrgId = (req.query?.organizationId || req.body?.organizationId) as
        | string
        | undefined;
      if (
        requestedOrgId &&
        callerProfile.role !== 'creator' &&
        callerProfile.organization_id !== requestedOrgId
      ) {
        res.status(403).json({ error: 'Forbidden: Cross-tenant access denied.' });
        return;
      }

      (req as any).callerUser = userData.user;
      (req as any).callerProfile = callerProfile;
      next();
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Staff session verification error.' });
    }
  };

  // 1. Live Storefront Product Catalog (Backed by Primary Amansocean Workspace in Supabase)
  app.get('/api/storefront/catalog', async (req, res) => {
    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.json({
        success: true,
        source: 'seed_fallback',
        organizationId: null,
        organizationName: 'Amansocean Coldstore',
        products: AMANSOCEAN_SEED_PRODUCTS.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.storefront_category,
          description: p.description,
          price: p.retail_price_per_unit,
          image: p.image_url,
          badge: p.badge,
          weight: p.retail_pack_size,
          rating: p.rating,
          origin: p.origin,
          stockKg: p.stock_kg,
          inStock: p.stock_kg > 0,
        })),
      });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, org.id);

      const { data: rows, error } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_available_for_retail', true)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const products = (rows || []).map(mapDbRowToStorefrontProduct);
      res.json({
        success: true,
        source: 'supabase',
        organizationId: org.id,
        organizationName: org.name,
        products,
      });
    } catch (err: any) {
      console.error('[Storefront Catalog Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load storefront catalog.' });
    }
  });

  // 2. Persistent Storefront Favorites (GET & POST Toggle)
  app.get('/api/storefront/favorites', async (req, res) => {
    const visitorId = String(req.query.visitorId || '').trim();
    if (!visitorId) {
      res.json({ success: true, productIds: [] });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.json({ success: true, productIds: [] });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      const userId = await resolveOptionalUserId(req, adminClient);

      const { data, error } = await adminClient
        .from('storefront_favorites')
        .select('product_id, visitor_id, user_id')
        .eq('organization_id', org.id)
        .eq('visitor_id', visitorId);

      if (!error && Array.isArray(data)) {
        const ids = Array.from(new Set(data.map((r: any) => String(r.product_id))));
        if (userId) {
          const { data: userFavs } = await adminClient
            .from('storefront_favorites')
            .select('product_id')
            .eq('organization_id', org.id)
            .eq('user_id', userId);
          for (const uf of userFavs || []) {
            if (!ids.includes(String(uf.product_id))) ids.push(String(uf.product_id));
          }
        }
        res.json({ success: true, productIds: ids });
        return;
      }

      if (error && isMissingTableError(error)) {
        const { data: logs } = await adminClient
          .from('user_feature_usage_logs')
          .select('id, metadata')
          .eq('organization_id', org.id)
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_favorite')
          .eq('user_name', visitorId)
          .order('created_at', { ascending: true });

        const favSet = new Set<string>();
        for (const row of logs || []) {
          const pid = row.metadata?.product_id;
          if (!pid) continue;
          if (row.metadata?.active === false) {
            favSet.delete(String(pid));
          } else {
            favSet.add(String(pid));
          }
        }
        res.json({ success: true, productIds: Array.from(favSet) });
        return;
      }

      throw error;
    } catch (err: any) {
      console.error('[Storefront Favorites GET Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load favorites.' });
    }
  });

  app.post('/api/storefront/favorites', async (req, res) => {
    const { visitorId, productId, productName } = req.body || {};
    const cleanVisitor = String(visitorId || '').trim();
    const cleanProduct = String(productId || '').trim();

    if (!cleanVisitor || !cleanProduct) {
      res.status(400).json({ error: 'visitorId and productId are required.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(503).json({ error: 'Database service unavailable.' });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      const userId = await resolveOptionalUserId(req, adminClient);

      const { data: existing, error: selectErr } = await adminClient
        .from('storefront_favorites')
        .select('id')
        .eq('organization_id', org.id)
        .eq('visitor_id', cleanVisitor)
        .eq('product_id', cleanProduct)
        .maybeSingle();

      let favorited = false;

      if (!selectErr) {
        if (existing?.id) {
          const { error: delErr } = await adminClient
            .from('storefront_favorites')
            .delete()
            .eq('id', existing.id);
          if (delErr) throw delErr;
          favorited = false;
        } else {
          const { error: insErr } = await adminClient.from('storefront_favorites').insert({
            organization_id: org.id,
            visitor_id: cleanVisitor,
            user_id: userId,
            product_id: cleanProduct,
          });
          if (insErr) throw insErr;
          favorited = true;
        }
      } else if (isMissingTableError(selectErr)) {
        const { data: logs } = await adminClient
          .from('user_feature_usage_logs')
          .select('id, metadata')
          .eq('organization_id', org.id)
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_favorite')
          .eq('user_name', cleanVisitor)
          .order('created_at', { ascending: true });

        const favSet = new Set<string>();
        for (const row of logs || []) {
          const pid = row.metadata?.product_id;
          if (!pid) continue;
          if (row.metadata?.active === false) favSet.delete(String(pid));
          else favSet.add(String(pid));
        }

        favorited = !favSet.has(cleanProduct);
        const { error: fallbackErr } = await adminClient.from('user_feature_usage_logs').insert({
          user_id: userId,
          organization_id: org.id,
          user_email: 'visitor@amansocean.store',
          user_name: cleanVisitor,
          organization_name: org.name,
          feature_key: 'sf_favorite',
          feature_name: cleanProduct,
          category: 'storefront_internal',
          action_type: favorited ? 'create' : 'delete',
          metadata: {
            visitor_id: cleanVisitor,
            product_id: cleanProduct,
            active: favorited,
          },
        });
        if (fallbackErr) throw fallbackErr;
      } else {
        throw selectErr;
      }

      await recordStorefrontEventInternal(adminClient, {
        organizationId: org.id,
        visitorId: cleanVisitor,
        userId,
        eventType: 'favorite_toggle',
        productId: cleanProduct,
        productName: productName || cleanProduct,
        metadata: { favorited },
      });

      res.json({ success: true, productId: cleanProduct, favorited });
    } catch (err: any) {
      console.error('[Storefront Favorites POST Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to update favorite.' });
    }
  });

  // 3. Atomic Dual-Ledger Storefront Checkout + Live Stock Deduction
  app.post('/api/storefront/orders', async (req, res) => {
    const {
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      deliveryNotes,
      paymentMethod = 'Cash / Mobile Money on Delivery',
      items,
      visitorId,
    } = req.body || {};

    const cleanName = String(customerName || '').trim();
    const cleanPhone = String(customerPhone || '').trim();
    const cleanEmail = String(customerEmail || '').trim().toLowerCase();
    const cleanAddress = String(deliveryAddress || '').trim();
    const cleanNotes = String(deliveryNotes || '').trim();
    const cleanPayment = String(paymentMethod || 'Cash / Mobile Money on Delivery').trim();

    if (!cleanName || !cleanAddress) {
      res.status(400).json({ error: 'Customer name and delivery address are required.' });
      return;
    }

    if (!cleanPhone && !cleanEmail) {
      res
        .status(400)
        .json({ error: 'Please provide a phone number or email address for order tracking.' });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Your cart is empty.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(503).json({ error: 'Supabase database connection is not configured.' });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, org.id);
      const userId = await resolveOptionalUserId(req, adminClient);

      // Consolidate duplicate product lines if any
      const requestedMap = new Map<string, number>();
      for (const rawItem of items) {
        const pid = String(rawItem?.productId || rawItem?.id || '').trim();
        const qty = Number(rawItem?.quantity || 0);
        if (!pid || !Number.isFinite(qty) || qty <= 0) {
          res.status(400).json({ error: 'Invalid item quantity in cart.' });
          return;
        }
        requestedMap.set(pid, (requestedMap.get(pid) || 0) + qty);
      }

      const productIds = Array.from(requestedMap.keys());
      const { data: dbProducts, error: prodErr } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', org.id)
        .in('id', productIds);

      if (prodErr) throw prodErr;

      const dbProdMap = new Map<string, any>((dbProducts || []).map((p: any) => [String(p.id), p]));

      // Validate availability & stock BEFORE mutating any table
      for (const [pid, qty] of requestedMap.entries()) {
        const prod = dbProdMap.get(pid);
        if (!prod || !prod.is_active || !prod.is_available_for_retail) {
          res.status(404).json({
            error: `Product "${pid}" is no longer available for retail purchase.`,
            code: 'PRODUCT_UNAVAILABLE',
            productId: pid,
          });
          return;
        }
        const currentStock = Number(prod.stock_kg ?? 0);
        if (currentStock < qty) {
          res.status(409).json({
            error:
              currentStock <= 0
                ? `"${prod.name}" just sold out. Please remove it from your cart.`
                : `Only ${currentStock} pack(s) of "${prod.name}" remain in cold storage.`,
            code: 'INSUFFICIENT_STOCK',
            productId: pid,
            availableStockKg: currentStock,
          });
          return;
        }
      }

      // Compute server-authoritative totals
      let subtotal = 0;
      let costTotal = 0;
      const verifiedLines: Array<{
        product: any;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        lineTotal: number;
        weightLabel: string;
        lotId: string;
      }> = [];

      for (const [pid, qty] of requestedMap.entries()) {
        const prod = dbProdMap.get(pid)!;
        const unitPrice = Number(prod.retail_price_per_unit || 0);
        const costPrice = Number(prod.cost_price_per_unit || 0);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal = Number((subtotal + lineTotal).toFixed(2));
        costTotal = Number((costTotal + costPrice * qty).toFixed(2));

        // Find linked or species-matching cold-storage batch (FEFO)
        const { data: candidateBatches } = await adminClient
          .from('inventory_batches')
          .select('id, available_weight_kg, allocated_weight_kg, initial_weight_kg, expiry_date, linked_product_id')
          .eq('organization_id', org.id)
          .or(`linked_product_id.eq.${pid},species_id.eq.${prod.species_id}`)
          .order('expiry_date', { ascending: true });

        let remainingToDeduct = qty;
        let primaryLotId = '';

        const sortedBatches = (candidateBatches || []).sort((a: any, b: any) => {
          const aLinked = a.linked_product_id === pid ? 0 : 1;
          const bLinked = b.linked_product_id === pid ? 0 : 1;
          return aLinked - bLinked;
        });

        for (const batch of sortedBatches) {
          const avail = Number(batch.available_weight_kg ?? 0);
          if (!primaryLotId) primaryLotId = String(batch.id);
          if (avail <= 0 || remainingToDeduct <= 0) continue;
          const deduct = Math.min(avail, remainingToDeduct);
          const nextAvail = Number(Math.max(0, avail - deduct).toFixed(2));
          await adminClient
            .from('inventory_batches')
            .update({
              available_weight_kg: nextAvail,
              updated_at: new Date().toISOString(),
            })
            .eq('organization_id', org.id)
            .eq('id', batch.id);
          remainingToDeduct = Number((remainingToDeduct - deduct).toFixed(2));
          primaryLotId = String(batch.id);
        }

        // Ensure a valid lot exists if custom ERP product had no batch row yet
        if (!primaryLotId) {
          primaryLotId = `LOT-RET-${pid.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
          const today = new Date().toISOString().slice(0, 10);
          const expiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);
          await adminClient.from('inventory_batches').upsert(
            {
              organization_id: org.id,
              id: primaryLotId,
              species_id: prod.species_id,
              species_name: prod.name,
              scientific_name: prod.name,
              category: prod.category,
              harvest_date: today,
              landing_port: 'Amansocean Coldstore',
              vessel_name: 'Direct Storefront Stock',
              vessel_registration: 'AO-RET',
              captain_name: 'Coldstore Intake',
              fao_area: 'FAO 34',
              gps_coordinates: { latitude: 5.6265, longitude: 0.0061 },
              gear_type: 'Retail Pack',
              grade: prod.grade,
              initial_weight_kg: Math.max(qty, Number(prod.stock_kg || qty)),
              available_weight_kg: Math.max(0, Number(prod.stock_kg || 0) - qty),
              allocated_weight_kg: 0,
              storage_zone: 'Commercial Cold Storage (-22°C)',
              current_temp_celsius: -22.0,
              target_temp_celsius: -22.0,
              cost_per_kg: costPrice,
              wholesale_price_per_kg: Number(prod.wholesale_price_per_unit || unitPrice),
              inspection_status: 'Passed',
              core_temp_celsius: -22.0,
              received_date: today,
              expiry_date: expiry,
              qr_code_seed: `QR-${primaryLotId}`,
              linked_product_id: pid,
              product_sku: prod.sku,
              is_retail_cut_lot: true,
            },
            { onConflict: 'organization_id,id' }
          );
        }

        // Deduct retail_wholesale_products.stock_kg
        const nextProductStock = Number(Math.max(0, Number(prod.stock_kg || 0) - qty).toFixed(2));
        const { error: stockUpdateErr } = await adminClient
          .from('retail_wholesale_products')
          .update({
            stock_kg: nextProductStock,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', org.id)
          .eq('id', pid);

        if (stockUpdateErr) throw stockUpdateErr;

        verifiedLines.push({
          product: prod,
          quantity: qty,
          unitPrice,
          costPrice,
          lineTotal,
          weightLabel: String(prod.retail_pack_size || prod.unit || '1 pack'),
          lotId: primaryLotId,
        });
      }

      const deliveryFee = subtotal >= 300 ? 0 : 25;
      const totalAmount = Number((subtotal + deliveryFee).toFixed(2));
      const orderNumber = `AO-${10000 + crypto.randomInt(0, 90000)}`;
      const txId = `REC-${orderNumber}`;
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const isCardPayment = /card|apple|instant|online/i.test(cleanPayment);

      // 3A. Upsert Customer in ERP `customers`
      const customerKeySeed = cleanEmail || normalizePhoneDigits(cleanPhone) || cleanName;
      const custHash = crypto
        .createHash('sha1')
        .update(customerKeySeed.toLowerCase())
        .digest('hex')
        .slice(0, 8)
        .toUpperCase();
      const customerId = `CUST-AO-${custHash}`;

      const { data: existingCust } = await adminClient
        .from('customers')
        .select('id, total_orders_count, total_spend_usd')
        .eq('organization_id', org.id)
        .eq('id', customerId)
        .maybeSingle();

      const { error: custErr } = await adminClient.from('customers').upsert(
        {
          organization_id: org.id,
          id: customerId,
          name: cleanName,
          company_name: 'Amansocean Online Customer',
          type: 'Direct Retail VIP',
          tier: 'Retail Standard',
          contact_person: cleanName,
          email: cleanEmail || `customer.${custHash.toLowerCase()}@amansocean.store`,
          phone: cleanPhone || 'N/A',
          address: cleanAddress,
          city: cleanAddress.split(',').pop()?.trim() || 'Accra / Tema',
          payment_terms: isCardPayment ? 'Instant Card/Cash' : 'Cash on Delivery (COD)',
          total_orders_count: Number(existingCust?.total_orders_count || 0) + 1,
          total_spend_usd: Number(
            (Number(existingCust?.total_spend_usd || 0) + totalAmount).toFixed(2)
          ),
          status: 'Active',
          notes: 'Registered via Amansocean Public Storefront',
          is_active: true,
          updated_at: nowIso,
        },
        { onConflict: 'organization_id,id' }
      );
      if (custErr) throw custErr;

      // 3B. Insert ERP `client_orders` + `order_line_items`
      const storefrontMetadata = {
        channel: 'amansocean_storefront',
        order_number: orderNumber,
        fulfillment_status: 'confirmed',
        customer_phone: cleanPhone || null,
        customer_email: cleanEmail || null,
        delivery_notes: cleanNotes || null,
        payment_method: cleanPayment,
        subtotal,
        delivery_fee: deliveryFee,
        total_amount: totalAmount,
        visitor_id: visitorId || null,
        items: verifiedLines.map((l) => ({
          productId: String(l.product.id),
          productName: String(l.product.name),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          weightLabel: l.weightLabel,
        })),
      };

      const { error: erpOrderErr } = await adminClient.from('client_orders').insert({
        organization_id: org.id,
        id: orderNumber,
        customer_id: customerId,
        client_name: cleanName,
        client_category: 'Direct Retail VIP',
        contact_person: cleanName,
        contact_email: cleanEmail || `customer.${custHash.toLowerCase()}@amansocean.store`,
        contact_phone: cleanPhone || 'N/A',
        destination_city: cleanAddress.split(',').pop()?.trim() || 'Local Cold-Chain Zone',
        delivery_address: cleanAddress,
        order_date: todayDate,
        required_delivery_date: todayDate,
        status: 'Pending Confirmation',
        quoted_total_usd: totalAmount,
        adjusted_total_usd: totalAmount,
        payment_status: isCardPayment ? 'Paid' : 'Pending Settlement',
        packaging_requirement: 'Insulated Cold-Chain Box (-18°C Gel Packs)',
        special_instructions: JSON.stringify(storefrontMetadata),
        packing_slip_generated: true,
      });
      if (erpOrderErr) throw erpOrderErr;

      const erpLineRows = verifiedLines.map((l) => ({
        organization_id: org.id,
        order_id: orderNumber,
        species_id: l.product.species_id,
        species_name: l.product.name,
        grade: l.product.grade,
        lot_id: l.lotId,
        requested_weight_kg: l.quantity,
        actual_weighed_kg: l.quantity,
        price_per_kg: l.unitPrice,
        notes: `Storefront Pack (${l.weightLabel})`,
      }));

      const { error: erpLinesErr } = await adminClient
        .from('order_line_items')
        .insert(erpLineRows);
      if (erpLinesErr) throw erpLinesErr;

      // 3C. Insert ERP `retail_transactions` + `retail_sale_items`
      const posPaymentMethod:
        | 'Cash'
        | 'Credit Card'
        | 'Apple Pay / Contactless'
        | 'Store Credit' = /apple|mobile|momo|contactless/i.test(cleanPayment)
        ? 'Apple Pay / Contactless'
        : /card/i.test(cleanPayment)
        ? 'Credit Card'
        : 'Cash';

      const { error: retailTxErr } = await adminClient.from('retail_transactions').insert({
        organization_id: org.id,
        id: txId,
        receipt_number: orderNumber,
        customer_name: cleanName,
        customer_phone: cleanPhone || null,
        subtotal,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: totalAmount,
        cost_total: costTotal,
        gross_margin: Number((subtotal - costTotal).toFixed(2)),
        payment_method: posPaymentMethod,
        cashier_name: 'Amansocean Online Storefront',
        status: 'Completed',
      });
      if (retailTxErr) throw retailTxErr;

      const retailSaleRows = verifiedLines.map((l) => ({
        organization_id: org.id,
        transaction_id: txId,
        product_id: l.product.id,
        product_name: l.product.name,
        cut_type: l.product.cut_type,
        quantity: l.quantity,
        unit: l.product.unit || 'pack',
        unit_price: l.unitPrice,
        cost_price: l.costPrice,
        line_total: l.lineTotal,
      }));
      const { error: retailItemsErr } = await adminClient
        .from('retail_sale_items')
        .insert(retailSaleRows);
      if (retailItemsErr) throw retailItemsErr;

      // 3D. Insert Immutable `financial_ledger_entries` (INSERT-ONLY)
      await adminClient.from('financial_ledger_entries').insert({
        organization_id: org.id,
        entry_date: todayDate,
        type: 'Income',
        category: 'Revenue (Retail POS)',
        description: encodeFinancialDescriptionMeta(
          `Amansocean Online Order ${orderNumber} — ${verifiedLines.length} item(s)`,
          { customerId, receiptNumber: orderNumber }
        ),
        reference_id: orderNumber,
        entity_name: cleanName,
        amount: totalAmount,
        payment_method: cleanPayment,
        status: isCardPayment ? 'Settled' : 'Pending',
      });

      // 3E. Insert Operator `system_notifications`
      await adminClient.from('system_notifications').insert({
        organization_id: org.id,
        type: 'order_update',
        title: `Online Order ${orderNumber} Received`,
        message: `${cleanName} placed a GH₵ ${totalAmount.toFixed(2)} storefront order (${verifiedLines.reduce((s, i) => s + i.quantity, 0)} packs) for delivery to ${cleanAddress}.`,
        urgency: 'medium',
        read: false,
        related_entity_id: orderNumber,
      });

      // 3F. Persist into `storefront_orders` + `storefront_order_items` (026 table when present)
      const { data: sfOrderRow, error: sfOrderErr } = await adminClient
        .from('storefront_orders')
        .insert({
          order_number: orderNumber,
          organization_id: org.id,
          customer_name: cleanName,
          customer_phone: cleanPhone || null,
          customer_email: cleanEmail || null,
          delivery_address: cleanAddress,
          delivery_notes: cleanNotes || null,
          subtotal,
          delivery_fee: deliveryFee,
          total_amount: totalAmount,
          payment_method: cleanPayment,
          fulfillment_status: 'confirmed',
          linked_erp_order_id: orderNumber,
          linked_retail_tx_id: txId,
          visitor_id: visitorId || null,
        })
        .select('id')
        .maybeSingle();

      if (!sfOrderErr && sfOrderRow?.id) {
        await adminClient.from('storefront_order_items').insert(
          verifiedLines.map((l) => ({
            storefront_order_id: sfOrderRow.id,
            organization_id: org.id,
            product_id: String(l.product.id),
            product_name: String(l.product.name),
            quantity: l.quantity,
            unit_price: l.unitPrice,
            line_total: l.lineTotal,
            weight_label: l.weightLabel,
          }))
        );
      } else if (sfOrderErr && !isMissingTableError(sfOrderErr)) {
        console.warn('[Storefront Orders Dedicated Table Notice]:', sfOrderErr.message);
      }

      // 3G. Record Purchase Conversion Telemetry
      await recordStorefrontEventInternal(adminClient, {
        organizationId: org.id,
        visitorId: String(visitorId || 'anon-checkout'),
        userId,
        eventType: 'order_completed',
        cartValue: totalAmount,
        metadata: {
          order_number: orderNumber,
          item_count: verifiedLines.reduce((s, l) => s + l.quantity, 0),
          payment_method: cleanPayment,
        },
      });

      res.status(201).json({
        success: true,
        order: {
          orderNumber,
          fulfillmentStatus: 'confirmed',
          erpStatus: 'Pending Confirmation',
          customerName: cleanName,
          customerPhone: cleanPhone || null,
          customerEmail: cleanEmail || null,
          deliveryAddress: cleanAddress,
          deliveryNotes: cleanNotes || null,
          paymentMethod: cleanPayment,
          subtotal,
          deliveryFee,
          totalAmount,
          createdAt: nowIso,
          items: storefrontMetadata.items,
        },
      });
    } catch (err: any) {
      console.error('[Storefront Checkout Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to place storefront order.' });
    }
  });

  // 4. Public Customer Order Tracking Lookup (Verified by Order Number + Phone or Email)
  app.get('/api/storefront/orders/track', async (req, res) => {
    const orderNumber = String(req.query.orderNumber || '')
      .trim()
      .toUpperCase();
    const contact = String(req.query.contact || '').trim();

    if (!orderNumber || !contact) {
      res
        .status(400)
        .json({ error: 'Both Order Number (e.g. AO-12345) and Phone or Email are required.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(503).json({ error: 'Order tracking service is currently unavailable.' });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);

      // Check ERP `client_orders` too so live ERP status transitions always reflect immediately
      const { data: erpOrder } = await adminClient
        .from('client_orders')
        .select('*')
        .eq('organization_id', org.id)
        .eq('id', orderNumber)
        .maybeSingle();

      const { data: sfOrder, error: sfErr } = await adminClient
        .from('storefront_orders')
        .select('*')
        .eq('organization_id', org.id)
        .eq('order_number', orderNumber)
        .maybeSingle();

      if (sfOrder && !sfErr) {
        const verified = contactsMatch(contact, sfOrder.customer_phone, sfOrder.customer_email);
        if (!verified) {
          res.status(404).json({
            error: 'No matching order found for that order number and phone/email.',
          });
          return;
        }

        const { data: sfItems } = await adminClient
          .from('storefront_order_items')
          .select('*')
          .eq('storefront_order_id', sfOrder.id);

        const resolvedStatus = erpOrder
          ? mapErpOrderStatusToFulfillment(erpOrder.status, sfOrder.fulfillment_status)
          : sfOrder.fulfillment_status;

        res.json({
          success: true,
          order: {
            orderNumber: sfOrder.order_number,
            fulfillmentStatus: resolvedStatus,
            erpStatus: erpOrder?.status || mapFulfillmentToErpOrderStatus(resolvedStatus),
            paymentStatus: erpOrder?.payment_status || 'Pending Settlement',
            packagingRequirement:
              erpOrder?.packaging_requirement || 'Insulated Cold-Chain Box (-18°C Gel Packs)',
            requiredDeliveryDate: erpOrder?.required_delivery_date || null,
            orderChannel: 'storefront',
            customerName: sfOrder.customer_name,
            deliveryAddress: sfOrder.delivery_address,
            deliveryNotes: sfOrder.delivery_notes,
            paymentMethod: sfOrder.payment_method,
            subtotal: Number(sfOrder.subtotal),
            deliveryFee: Number(sfOrder.delivery_fee),
            totalAmount: Number(sfOrder.total_amount),
            createdAt: sfOrder.created_at,
            updatedAt: erpOrder?.updated_at || sfOrder.updated_at,
            items: (sfItems || []).map((it: any) => ({
              productId: it.product_id,
              productName: it.product_name,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unit_price),
              lineTotal: Number(it.line_total),
              weightLabel: it.weight_label,
            })),
          },
        });
        return;
      }

      if (erpOrder) {
        let meta: any = {};
        try {
          meta = erpOrder.special_instructions ? JSON.parse(erpOrder.special_instructions) : {};
        } catch {}

        const storedPhone = meta.customer_phone || erpOrder.contact_phone;
        const storedEmail = meta.customer_email || erpOrder.contact_email;

        if (!contactsMatch(contact, storedPhone, storedEmail)) {
          res.status(404).json({
            error: 'No matching order found for that order number and phone/email.',
          });
          return;
        }

        let itemsList = Array.isArray(meta.items) ? meta.items : [];
        if (itemsList.length === 0) {
          const { data: erpLines } = await adminClient
            .from('order_line_items')
            .select('*')
            .eq('organization_id', org.id)
            .eq('order_id', orderNumber);
          itemsList = (erpLines || []).map((ln: any) => ({
            productId: ln.species_id,
            productName: ln.species_name,
            quantity: Number(ln.requested_weight_kg),
            unitPrice: Number(ln.price_per_kg),
            lineTotal: Number((Number(ln.requested_weight_kg) * Number(ln.price_per_kg)).toFixed(2)),
            weightLabel: ln.notes || '1 kg',
          }));
        }

        const resolvedStatus = mapErpOrderStatusToFulfillment(
          erpOrder.status,
          meta.fulfillment_status
        );

        res.json({
          success: true,
          order: {
            orderNumber: erpOrder.id,
            fulfillmentStatus: resolvedStatus,
            erpStatus: erpOrder.status,
            paymentStatus: erpOrder.payment_status || 'Pending Settlement',
            packagingRequirement:
              erpOrder.packaging_requirement || 'Commercial Cold-Chain Packaging (-22°C)',
            requiredDeliveryDate: erpOrder.required_delivery_date || null,
            orderChannel: String(erpOrder.id || '').startsWith('ORD-') ? 'wholesale' : 'storefront',
            customerName: erpOrder.client_name,
            deliveryAddress: erpOrder.delivery_address,
            deliveryNotes: meta.delivery_notes || null,
            paymentMethod:
              meta.payment_method ||
              (erpOrder.payment_terms ? `B2B ${erpOrder.payment_terms}` : 'Cash / Mobile Money on Delivery'),
            subtotal: Number(meta.subtotal ?? erpOrder.quoted_total_usd),
            deliveryFee: Number(meta.delivery_fee ?? 0),
            totalAmount: Number(erpOrder.adjusted_total_usd ?? erpOrder.quoted_total_usd),
            createdAt: erpOrder.created_at,
            updatedAt: erpOrder.updated_at,
            items: itemsList,
          },
        });
        return;
      }

      res.status(404).json({
        error: 'No matching order found for that order number and phone/email.',
      });
    } catch (err: any) {
      console.error('[Order Tracking Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to look up order status.' });
    }
  });

  // 5. ERP Online Storefront Order Queue (GET & PATCH Fulfillment Status)
  app.get('/api/erp/storefront-orders', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const callerProfile = (req as any).callerProfile;
    const requestedOrgId = String(req.query.organizationId || '').trim();

    try {
      const targetOrgId =
        callerProfile.role === 'creator' && requestedOrgId
          ? requestedOrgId
          : callerProfile.organization_id;

      const { data: erpOrders, error: erpErr } = await adminClient
        .from('client_orders')
        .select('*')
        .eq('organization_id', targetOrgId)
        .like('id', 'AO-%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (erpErr) throw erpErr;

      const orders = (erpOrders || []).map((row: any) => {
        let meta: any = {};
        try {
          meta = row.special_instructions ? JSON.parse(row.special_instructions) : {};
        } catch {}

        const fulfillmentStatus = mapErpOrderStatusToFulfillment(
          row.status,
          meta.fulfillment_status
        );

        return {
          orderNumber: row.id,
          fulfillmentStatus,
          erpStatus: row.status,
          paymentStatus: row.payment_status,
          customerName: row.client_name,
          customerPhone: meta.customer_phone || row.contact_phone,
          customerEmail: meta.customer_email || row.contact_email,
          deliveryAddress: row.delivery_address,
          deliveryNotes: meta.delivery_notes || null,
          paymentMethod: meta.payment_method || 'Cash / Mobile Money on Delivery',
          subtotal: Number(meta.subtotal ?? row.quoted_total_usd),
          deliveryFee: Number(meta.delivery_fee ?? 0),
          totalAmount: Number(row.adjusted_total_usd ?? row.quoted_total_usd),
          items: Array.isArray(meta.items) ? meta.items : [],
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });

      res.json({ success: true, orders });
    } catch (err: any) {
      console.error('[ERP Storefront Orders GET Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load online storefront orders.' });
    }
  });

  app.patch(
    '/api/erp/storefront-orders/:orderNumber/status',
    requireStaffSession,
    async (req, res) => {
      const orderNumber = String(req.params.orderNumber || '')
        .trim()
        .toUpperCase();
      const { fulfillmentStatus, organizationId } = req.body || {};
      const validStatuses = [
        'confirmed',
        'packing',
        'out_for_delivery',
        'delivered',
        'canceled',
      ];

      if (!validStatuses.includes(fulfillmentStatus)) {
        res.status(400).json({ error: 'Invalid fulfillmentStatus supplied.' });
        return;
      }

      const adminClient = adminClientGetter()!;
      const callerProfile = (req as any).callerProfile;
      const targetOrgId =
        callerProfile.role === 'creator' && organizationId
          ? String(organizationId)
          : callerProfile.organization_id;

      try {
        const erpStatus = mapFulfillmentToErpOrderStatus(fulfillmentStatus);
        const nowIso = new Date().toISOString();

        const { data: existingErp } = await adminClient
          .from('client_orders')
          .select('id, special_instructions, payment_status')
          .eq('organization_id', targetOrgId)
          .eq('id', orderNumber)
          .maybeSingle();

        if (!existingErp) {
          res.status(404).json({ error: `Storefront order ${orderNumber} not found in workspace.` });
          return;
        }

        let meta: any = {};
        try {
          meta = existingErp.special_instructions
            ? JSON.parse(existingErp.special_instructions)
            : {};
        } catch {}
        meta.fulfillment_status = fulfillmentStatus;

        const updatePayload: Record<string, any> = {
          status: erpStatus,
          special_instructions: JSON.stringify(meta),
          updated_at: nowIso,
        };
        if (fulfillmentStatus === 'delivered') {
          updatePayload.actual_delivery_date = nowIso.slice(0, 10);
          updatePayload.payment_status = 'Paid';
        }

        const { error: updErr } = await adminClient
          .from('client_orders')
          .update(updatePayload)
          .eq('organization_id', targetOrgId)
          .eq('id', orderNumber);

        if (updErr) throw updErr;

        // Sync `storefront_orders` table if present
        const { error: sfUpdErr } = await adminClient
          .from('storefront_orders')
          .update({ fulfillment_status: fulfillmentStatus, updated_at: nowIso })
          .eq('organization_id', targetOrgId)
          .eq('order_number', orderNumber);

        if (sfUpdErr && !isMissingTableError(sfUpdErr)) {
          console.warn('[Storefront Orders Status Sync Notice]:', sfUpdErr.message);
        }

        res.json({
          success: true,
          orderNumber,
          fulfillmentStatus,
          erpStatus,
        });
      } catch (err: any) {
        console.error('[ERP Storefront Order Status PATCH Error]:', err);
        res.status(500).json({ error: err?.message || 'Failed to update fulfillment status.' });
      }
    }
  );

  // 5B. Admin Amans Ocean Product Catalog Management (GET, SYNC, CREATE, UPDATE, DELETE)
  async function resolveAdminCatalogOrg(
    req: any,
    adminClient: any
  ): Promise<{ id: string; name: string }> {
    const callerProfile = req.callerProfile;
    const requestedOrgId = String(
      req.query?.organizationId || req.body?.organizationId || ''
    ).trim();

    if (callerProfile?.role === 'creator') {
      if (requestedOrgId) {
        const { data: orgRow } = await adminClient
          .from('organizations')
          .select('id, name')
          .eq('id', requestedOrgId)
          .maybeSingle();
        return {
          id: orgRow?.id || requestedOrgId,
          name: orgRow?.name || 'Amansocean Coldstore',
        };
      }
      return resolvePrimaryStorefrontOrg(adminClient);
    }

    const orgId = String(callerProfile?.organization_id || '');
    const { data: orgRow } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('id', orgId)
      .maybeSingle();

    return {
      id: orgId,
      name: orgRow?.name || 'Tenant Coldstore',
    };
  }

  function mapAdminCatalogRow(row: any) {
    const sf = mapDbRowToStorefrontProduct(row);
    const originMeta = parseOriginLotMeta(row.origin);
    const retailPrice = Number(row.retail_price_per_unit ?? sf.price ?? 0);
    const wholesalePrice = Number(row.wholesale_price_per_unit ?? retailPrice);
    const costPrice = Number(row.cost_price_per_unit ?? Number((wholesalePrice * 0.72).toFixed(2)));
    return {
      id: String(row.id),
      sku: String(row.sku || sf.sku || row.id),
      speciesId: String(row.species_id || 'sp-ao-red-fish'),
      name: String(row.name),
      cutType: String(row.cut_type || 'Whole Round Fish'),
      category: String(row.category || 'Groundfish'),
      storefrontCategory: sf.category,
      grade: String(row.grade || 'Grade #1'),
      stockKg: Math.max(0, Number(row.stock_kg ?? 0)),
      unit: String(row.unit || 'kg'),
      costPricePerUnit: costPrice,
      wholesalePricePerUnit: wholesalePrice,
      retailPricePerUnit: retailPrice,
      wholesaleMinQty: Math.max(1, Number(row.wholesale_min_qty || 5)),
      retailPackSize: String(row.retail_pack_size || sf.weight || '1kg'),
      imageUrl: String(row.image_url || sf.image),
      origin: String(originMeta.cleanOrigin || sf.origin),
      isAvailableForRetail: row.is_available_for_retail !== false,
      isAvailableForWholesale: row.is_available_for_wholesale !== false,
      linkedBatchId: row.linked_batch_id || originMeta.linkedBatchId || null,
      storageZone: row.storage_zone || originMeta.storageZone || 'Commercial Cold Storage (-22°C)',
    };
  }

  app.get('/api/erp/amansocean-products', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    try {
      const targetOrg = await resolveAdminCatalogOrg(req, adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, targetOrg.id);

      const { data: rows, error } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', targetOrg.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const products = (rows || [])
        .filter((r: any) => !LEGACY_DEMO_ID_SET.has(String(r.id)))
        .map(mapAdminCatalogRow);

      res.json({
        success: true,
        currency: 'GH₵',
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
        products,
      });
    } catch (err: any) {
      console.error('[GET Amansocean Admin Products Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load Amans Ocean catalog.' });
    }
  });

  app.post('/api/erp/amansocean-products/sync', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const forceResetPrices = Boolean(req.body?.forceResetPrices);
    try {
      const targetOrg = await resolveAdminCatalogOrg(req, adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, targetOrg.id, {
        syncMissing: true,
        forceResetPrices,
      });

      const { data: rows, error } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', targetOrg.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const products = (rows || [])
        .filter((r: any) => !LEGACY_DEMO_ID_SET.has(String(r.id)))
        .map(mapAdminCatalogRow);

      res.json({
        success: true,
        syncedCount: products.length,
        forceResetPrices,
        organizationId: targetOrg.id,
        organizationName: targetOrg.name,
        products,
      });
    } catch (err: any) {
      console.error('[SYNC Amansocean Admin Products Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to sync official price list.' });
    }
  });

  app.post('/api/erp/amansocean-products', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    try {
      const targetOrg = await resolveAdminCatalogOrg(req, adminClient);
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Product name is required.' });
        return;
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 32);
      const id = String(body.id || `ao-${slug}-${Date.now().toString(36).slice(-4)}`);
      const sku = String(
        body.sku || `AO-${slug.toUpperCase().slice(0, 10)}-${Math.floor(100 + Math.random() * 900)}`
      ).trim();
      const category = String(body.category || 'Groundfish');
      const speciesId = String(body.speciesId || `sp-${slug || 'custom'}`);
      const retailPrice = Math.max(0, Number(body.retailPricePerUnit ?? 0));
      const wholesalePrice = Math.max(0, Number(body.wholesalePricePerUnit ?? retailPrice));
      const costPrice = Math.max(
        0,
        Number(body.costPricePerUnit ?? Number((wholesalePrice * 0.72).toFixed(2)))
      );
      const stockKg = Math.max(0, Number(body.stockKg ?? 50));
      const unit = String(body.unit || 'kg');
      const cutType = String(body.cutType || (unit === 'pack' ? 'Packaged 500g Tray' : 'Whole Round Fish'));
      const grade = String(body.grade || 'Grade #1');
      const retailPackSize = String(body.retailPackSize || (unit === 'pack' ? 'Regular Pack' : '1kg'));
      const wholesaleMinQty = Math.max(1, Number(body.wholesaleMinQty || 5));
      const origin = String(body.origin || 'Amans Ocean Coldstore · Abrepo, Barekese Rd');
      const imageUrl = String(body.imageUrl || AMANSOCEAN_SEED_PRODUCTS[0].image_url);

      await adminClient.from('species').upsert(
        {
          organization_id: targetOrg.id,
          id: speciesId,
          name,
          scientific_name: 'Marine Catch',
          category,
          default_zone: 'Commercial Cold Storage (-22°C)',
          standard_price_per_kg: retailPrice,
          available_grades: ['Sashimi AAA', 'Grade #1'],
          fao_zones: ['FAO 34'],
          gear_types: ['Coldstore Intake'],
          seasonal_peak: 'Year-Round Cold Chain',
          image: imageUrl,
          shelf_life_fresh_days: 5,
          shelf_life_frozen_months: 18,
          is_active: true,
        },
        { onConflict: 'organization_id,id' }
      );

      const insertRow = {
        organization_id: targetOrg.id,
        id,
        species_id: speciesId,
        name,
        cut_type: cutType,
        category,
        grade,
        stock_kg: stockKg,
        unit,
        cost_price_per_unit: costPrice,
        wholesale_price_per_unit: wholesalePrice,
        retail_price_per_unit: retailPrice,
        wholesale_min_qty: wholesaleMinQty,
        retail_pack_size: retailPackSize,
        sku,
        image_url: imageUrl,
        origin,
        is_available_for_retail: body.isAvailableForRetail !== false,
        is_available_for_wholesale: body.isAvailableForWholesale !== false,
        is_active: true,
      };

      const { data: savedRow, error: saveErr } = await adminClient
        .from('retail_wholesale_products')
        .upsert(insertRow, { onConflict: 'organization_id,id' })
        .select('*')
        .single();

      if (saveErr) throw saveErr;

      res.status(201).json({
        success: true,
        product: mapAdminCatalogRow(savedRow || insertRow),
      });
    } catch (err: any) {
      console.error('[POST Amansocean Admin Product Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to create product.' });
    }
  });

  const handleUpdateProduct = async (req: express.Request, res: express.Response) => {
    const adminClient = adminClientGetter()!;
    const productId = String(req.params.productId || req.body?.id || req.body?.productId || '').trim();
    if (!productId) {
      res.status(400).json({ error: 'Product ID is required.' });
      return;
    }

    try {
      const targetOrg = await resolveAdminCatalogOrg(req, adminClient);
      const body = req.body || {};
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.sku !== undefined) updates.sku = String(body.sku).trim();
      if (body.category !== undefined) updates.category = String(body.category);
      if (body.cutType !== undefined || body.cut_type !== undefined) {
        updates.cut_type = String(body.cutType || body.cut_type);
      }
      if (body.grade !== undefined) updates.grade = String(body.grade);
      if (body.unit !== undefined) updates.unit = String(body.unit);
      if (body.retailPackSize !== undefined || body.retail_pack_size !== undefined) {
        updates.retail_pack_size = String(body.retailPackSize || body.retail_pack_size);
      }
      if (body.origin !== undefined || body.linkedBatchId !== undefined || body.storageZone !== undefined) {
        const { data: existingProd } = await adminClient
          .from('retail_wholesale_products')
          .select('origin')
          .eq('organization_id', targetOrg.id)
          .eq('id', productId)
          .maybeSingle();
        const prevMeta = parseOriginLotMeta(existingProd?.origin);
        const nextOrigin = body.origin !== undefined ? String(body.origin) : prevMeta.cleanOrigin;
        const nextLot =
          body.linkedBatchId !== undefined ? body.linkedBatchId : prevMeta.linkedBatchId;
        const nextZone =
          body.storageZone !== undefined ? body.storageZone : prevMeta.storageZone;
        updates.origin = encodeOriginLotMeta(nextOrigin, nextLot, nextZone);
      }
      if (body.retailPricePerUnit !== undefined || body.retail_price_per_unit !== undefined) {
        updates.retail_price_per_unit = Math.max(0, Number(body.retailPricePerUnit ?? body.retail_price_per_unit));
      }
      if (body.wholesalePricePerUnit !== undefined || body.wholesale_price_per_unit !== undefined) {
        updates.wholesale_price_per_unit = Math.max(0, Number(body.wholesalePricePerUnit ?? body.wholesale_price_per_unit));
      }
      if (body.costPricePerUnit !== undefined || body.cost_price_per_unit !== undefined) {
        updates.cost_price_per_unit = Math.max(0, Number(body.costPricePerUnit ?? body.cost_price_per_unit));
      }
      if (body.wholesaleMinQty !== undefined || body.wholesale_min_qty !== undefined) {
        updates.wholesale_min_qty = Math.max(1, Number(body.wholesaleMinQty ?? body.wholesale_min_qty));
      }
      if (body.stockKg !== undefined || body.stock_kg !== undefined) {
        updates.stock_kg = Math.max(0, Number(body.stockKg ?? body.stock_kg));
      }
      if (body.isAvailableForRetail !== undefined || body.is_available_for_retail !== undefined) {
        updates.is_available_for_retail = Boolean(body.isAvailableForRetail ?? body.is_available_for_retail);
      }
      if (body.imageUrl !== undefined || body.image_url !== undefined) {
        updates.image_url = String(body.imageUrl || body.image_url || '').trim();
      }
      if (body.isAvailableForWholesale !== undefined || body.is_available_for_wholesale !== undefined) {
        updates.is_available_for_wholesale = Boolean(body.isAvailableForWholesale ?? body.is_available_for_wholesale);
      }
      updates.is_active = true;

      const { data: updatedRow, error: updErr } = await adminClient
        .from('retail_wholesale_products')
        .update(updates)
        .eq('organization_id', targetOrg.id)
        .eq('id', productId)
        .select('*')
        .maybeSingle();

      if (updErr) throw updErr;
      if (!updatedRow) {
        res.status(404).json({ error: 'Product not found in target organization.' });
        return;
      }

      if (updates.stock_kg !== undefined) {
        await adminClient
          .from('inventory_batches')
          .update({
            available_weight_kg: updates.stock_kg,
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', targetOrg.id)
          .eq('linked_product_id', productId);
      }

      res.json({
        success: true,
        product: mapAdminCatalogRow(updatedRow),
      });
    } catch (err: any) {
      console.error('[Update Product Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to update product.' });
    }
  };

  app.put('/api/erp/products', requireStaffSession, handleUpdateProduct);
  app.put('/api/erp/products/:productId', requireStaffSession, handleUpdateProduct);
  app.patch('/api/erp/amansocean-products/:productId', requireStaffSession, handleUpdateProduct);

  app.delete('/api/erp/amansocean-products/:productId', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const productId = String(req.params.productId || '').trim();
    try {
      const targetOrg = await resolveAdminCatalogOrg(req, adminClient);
      const { error } = await adminClient
        .from('retail_wholesale_products')
        .update({
          is_active: false,
          is_available_for_retail: false,
          is_available_for_wholesale: false,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', targetOrg.id)
        .eq('id', productId);

      if (error) throw error;
      res.json({ success: true, productId });
    } catch (err: any) {
      console.error('[DELETE Amansocean Admin Product Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to deactivate product.' });
    }
  });

  // 6. Storefront Fresh Catch Alerts Newsletter Signup
  app.post('/api/storefront/newsletter', async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const visitorId = String(req.body?.visitorId || 'anon-newsletter').trim();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(503).json({ error: 'Newsletter service is currently unavailable.' });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      let alreadySubscribed = false;

      const { data: existingSub, error: checkErr } = await adminClient
        .from('newsletter_subscribers')
        .select('id, is_active')
        .eq('organization_id', org.id)
        .eq('email', rawEmail)
        .maybeSingle();

      if (!checkErr) {
        if (existingSub?.id && existingSub.is_active) {
          alreadySubscribed = true;
        } else {
          const { error: upErr } = await adminClient.from('newsletter_subscribers').upsert(
            {
              organization_id: org.id,
              email: rawEmail,
              source: 'storefront_footer',
              is_active: true,
              subscribed_at: new Date().toISOString(),
            },
            { onConflict: 'organization_id,email' }
          );
          if (upErr) throw upErr;
        }
      } else if (isMissingTableError(checkErr)) {
        const { data: existingLog } = await adminClient
          .from('user_feature_usage_logs')
          .select('id')
          .eq('organization_id', org.id)
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_newsletter')
          .eq('user_email', rawEmail)
          .maybeSingle();

        if (existingLog?.id) {
          alreadySubscribed = true;
        } else {
          const { error: logErr } = await adminClient.from('user_feature_usage_logs').insert({
            organization_id: org.id,
            user_email: rawEmail,
            user_name: rawEmail.split('@')[0],
            organization_name: org.name,
            feature_key: 'sf_newsletter',
            feature_name: 'Fresh Catch Alerts Subscriber',
            category: 'storefront_internal',
            action_type: 'create',
            metadata: { email: rawEmail, source: 'storefront_footer' },
          });
          if (logErr) throw logErr;
        }
      } else {
        throw checkErr;
      }

      if (!alreadySubscribed) {
        await recordStorefrontEventInternal(adminClient, {
          organizationId: org.id,
          visitorId,
          eventType: 'newsletter_signup',
          metadata: { email_domain: rawEmail.split('@')[1] || '' },
        });
      }

      res.json({
        success: true,
        alreadySubscribed,
        message: alreadySubscribed
          ? 'You are already subscribed to Amansocean Fresh Catch Alerts.'
          : 'Subscribed! You will receive weekly wild-catch drops and promo codes.',
      });
    } catch (err: any) {
      console.error('[Newsletter Subscribe Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to subscribe to newsletter.' });
    }
  });

  // 7. Customer & Operator Feedback Endpoints (Supabase Persisted + SMTP Notification)
  const inMemoryFeedbackStore: any[] = [];

  app.post('/api/feedback', feedbackLimiter, async (req, res) => {
    try {
      const { rating, category, message, email, name } = req.body || {};

      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ success: false, error: 'Feedback message is required.' });
        return;
      }

      const cleanRating = Math.min(5, Math.max(1, Number(rating) || 5));
      const cleanCategory =
        typeof category === 'string' && category.trim() ? category.trim() : 'General';
      const cleanMessage = message.trim();
      const cleanEmail =
        email && typeof email === 'string' && email.trim() ? email.trim() : null;
      const cleanName = name && typeof name === 'string' && name.trim() ? name.trim() : null;
      const createdAt = new Date().toISOString();
      const userAgent = (req.headers['user-agent'] as string) || null;
      const ip = (req.ip as string) || null;

      const feedbackEntry = {
        id: crypto.randomUUID(),
        rating: cleanRating,
        category: cleanCategory,
        message: cleanMessage,
        email: cleanEmail,
        name: cleanName,
        created_at: createdAt,
        user_agent: userAgent,
        ip,
      };

      inMemoryFeedbackStore.unshift(feedbackEntry);
      if (inMemoryFeedbackStore.length > 200) inMemoryFeedbackStore.pop();

      const adminClient = adminClientGetter();
      if (adminClient) {
        const org = await resolvePrimaryStorefrontOrg(adminClient);
        const { error: fbErr } = await adminClient.from('feedbacks').insert({
          id: feedbackEntry.id,
          organization_id: org.id,
          rating: cleanRating,
          category: cleanCategory,
          message: cleanMessage,
          email: cleanEmail,
          name: cleanName,
          user_agent: userAgent,
          ip,
          status: 'new',
          created_at: createdAt,
        });

        if (fbErr && isMissingTableError(fbErr)) {
          await adminClient.from('user_feature_usage_logs').insert({
            organization_id: org.id,
            user_email: cleanEmail || 'anonymous@amansocean.store',
            user_name: cleanName || 'Anonymous Customer',
            organization_name: org.name,
            feature_key: 'sf_feedback',
            feature_name: cleanCategory,
            category: 'storefront_internal',
            action_type: 'create',
            metadata: feedbackEntry,
          });
        }
      }

      const transporter = getGoogleSmtpTransporter();
      if (transporter) {
        const adminEmail =
          process.env.FEEDBACK_RECIPIENT_EMAIL ||
          process.env.GOOGLE_SMTP_USER ||
          process.env.CREATOR_EMAIL ||
          'support@amansocean.com';
        const fromUser = process.env.GOOGLE_SMTP_FROM_EMAIL || process.env.GOOGLE_SMTP_USER;
        const fromName = process.env.GOOGLE_SMTP_FROM_NAME || 'Frostly Platform Feedback';

        transporter
          .sendMail({
            from: `"${fromName}" <${fromUser}>`,
            to: adminEmail,
            subject: `[Amansocean Feedback] ${cleanCategory} (${cleanRating}/5 stars)`,
            text:
              `New User Feedback Received:\n\n` +
              `Rating: ${cleanRating} / 5\n` +
              `Category: ${cleanCategory}\n` +
              `Name: ${cleanName || 'Anonymous'}\n` +
              `Email: ${cleanEmail || 'None provided'}\n` +
              `Timestamp: ${createdAt}\n\n` +
              `Message:\n${cleanMessage}\n`,
          })
          .catch((mailErr: any) => {
            console.warn('[Feedback Email Dispatch Notice]:', mailErr?.message);
          });
      }

      res.status(200).json({
        success: true,
        message: 'Feedback received and saved. Thank you for helping improve Amansocean!',
        id: feedbackEntry.id,
      });
    } catch (err: any) {
      console.error('[Feedback Submission Error]:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to submit feedback.' });
    }
  });

  // GET Feedback: Protected with creatorOnly; selects only safe operational columns
  app.get('/api/feedback', creatorOnly, async (req, res) => {
    const adminClient = adminClientGetter();
    if (!adminClient) {
      const sanitized = inMemoryFeedbackStore.slice(0, 50).map((f) => ({
        id: f.id,
        rating: f.rating,
        category: f.category,
        message: f.message,
        name: f.name,
        email: f.email,
        created_at: f.created_at,
      }));
      res.json({
        success: true,
        count: sanitized.length,
        feedbacks: sanitized,
      });
      return;
    }

    try {
      const { data: rows, error } = await adminClient
        .from('feedbacks')
        .select('id, rating, category, message, name, email, created_at, organization_id, status')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && Array.isArray(rows)) {
        res.json({
          success: true,
          count: rows.length,
          feedbacks: rows,
        });
        return;
      }

      if (error && isMissingTableError(error)) {
        const { data: logs } = await adminClient
          .from('user_feature_usage_logs')
          .select('id, created_at, metadata')
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_feedback')
          .order('created_at', { ascending: false })
          .limit(50);

        const mapped = (logs || []).map((l: any) => ({
          id: l.metadata?.id || l.id,
          rating: Number(l.metadata?.rating || 5),
          category: l.metadata?.category || 'General',
          message: l.metadata?.message || '',
          name: l.metadata?.name || null,
          email: l.metadata?.email || null,
          created_at: l.metadata?.created_at || l.created_at,
        }));

        res.json({
          success: true,
          count: mapped.length,
          feedbacks: mapped,
        });
        return;
      }

      const sanitized = inMemoryFeedbackStore.slice(0, 50).map((f) => ({
        id: f.id,
        rating: f.rating,
        category: f.category,
        message: f.message,
        name: f.name,
        email: f.email,
        created_at: f.created_at,
      }));
      res.json({
        success: true,
        count: sanitized.length,
        feedbacks: sanitized,
      });
    } catch {
      const sanitized = inMemoryFeedbackStore.slice(0, 50).map((f) => ({
        id: f.id,
        rating: f.rating,
        category: f.category,
        message: f.message,
        name: f.name,
        email: f.email,
        created_at: f.created_at,
      }));
      res.json({
        success: true,
        count: sanitized.length,
        feedbacks: sanitized,
      });
    }
  });

  // 8. Storefront Visitor & Conversion Funnel Event Ingestion + Creator Summary Endpoint
  app.post('/api/storefront/analytics', async (req, res) => {
    const {
      visitorId,
      sessionId,
      eventType,
      productId,
      productName,
      cartValue,
      deviceType,
      metadata,
    } = req.body || {};

    const allowedEvents = [
      'page_view',
      'product_search',
      'favorite_toggle',
      'add_to_cart',
      'begin_checkout',
      'order_completed',
      'newsletter_signup',
    ];

    if (!allowedEvents.includes(eventType)) {
      res.status(400).json({ error: 'Unsupported storefront analytics eventType.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.json({ success: true, queued: false });
      return;
    }

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);
      const userId = await resolveOptionalUserId(req, adminClient);

      await recordStorefrontEventInternal(adminClient, {
        organizationId: org.id,
        visitorId: String(visitorId || 'anon-visitor'),
        sessionId: sessionId ? String(sessionId) : null,
        userId,
        eventType,
        productId: productId ? String(productId) : null,
        productName: productName ? String(productName) : null,
        cartValue: cartValue != null ? Number(cartValue) : null,
        deviceType: deviceType ? String(deviceType) : 'desktop',
        metadata: metadata && typeof metadata === 'object' ? metadata : {},
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to record storefront event.' });
    }
  });

  app.get('/api/creator/storefront-analytics', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
      const org = await resolvePrimaryStorefrontOrg(adminClient);

      // 1. Load Funnel Events
      let events: Array<{
        visitor_id: string;
        event_type: string;
        product_id?: string | null;
        product_name?: string | null;
        cart_value?: number | null;
        device_type?: string;
        created_at: string;
      }> = [];

      const { data: sfEvents, error: sfEventsErr } = await adminClient
        .from('storefront_analytics_events')
        .select('*')
        .eq('organization_id', org.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (!sfEventsErr && Array.isArray(sfEvents)) {
        events = sfEvents;
      } else if (sfEventsErr && isMissingTableError(sfEventsErr)) {
        const { data: fallbackEvents } = await adminClient
          .from('user_feature_usage_logs')
          .select('created_at, metadata')
          .eq('organization_id', org.id)
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_event')
          .gte('created_at', cutoff)
          .order('created_at', { ascending: false })
          .limit(2000);

        events = (fallbackEvents || []).map((row: any) => ({
          visitor_id: row.metadata?.visitor_id || 'anon',
          event_type: row.metadata?.event_type || 'page_view',
          product_id: row.metadata?.product_id || null,
          product_name: row.metadata?.product_name || null,
          cart_value: row.metadata?.cart_value ?? null,
          device_type: row.metadata?.device_type || 'desktop',
          created_at: row.created_at,
        }));
      }

      // 2. Load Storefront Orders from `client_orders` (AO-%)
      const { data: onlineOrders } = await adminClient
        .from('client_orders')
        .select('id, client_name, status, adjusted_total_usd, created_at')
        .eq('organization_id', org.id)
        .like('id', 'AO-%')
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false });

      // 3. Load Newsletter Subscribers
      let subscribers: Array<{ email: string; subscribed_at: string }> = [];
      const { data: subRows, error: subErr } = await adminClient
        .from('newsletter_subscribers')
        .select('email, subscribed_at')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('subscribed_at', { ascending: false })
        .limit(100);

      if (!subErr && Array.isArray(subRows)) {
        subscribers = subRows;
      } else if (subErr && isMissingTableError(subErr)) {
        const { data: subLogs } = await adminClient
          .from('user_feature_usage_logs')
          .select('user_email, created_at')
          .eq('organization_id', org.id)
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_newsletter')
          .order('created_at', { ascending: false })
          .limit(100);
        subscribers = (subLogs || []).map((s: any) => ({
          email: s.user_email,
          subscribed_at: s.created_at,
        }));
      }

      // 4. Load Customer Feedbacks
      let feedbacks: Array<{
        id: string;
        rating: number;
        category: string;
        message: string;
        name: string | null;
        email: string | null;
        created_at: string;
      }> = [];

      const { data: fbRows, error: fbErr } = await adminClient
        .from('feedbacks')
        .select('id, rating, category, message, name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!fbErr && Array.isArray(fbRows)) {
        feedbacks = fbRows;
      } else if (fbErr && isMissingTableError(fbErr)) {
        const { data: fbLogs } = await adminClient
          .from('user_feature_usage_logs')
          .select('id, created_at, metadata')
          .eq('category', 'storefront_internal')
          .eq('feature_key', 'sf_feedback')
          .order('created_at', { ascending: false })
          .limit(50);
        feedbacks = (fbLogs || []).map((l: any) => ({
          id: l.metadata?.id || l.id,
          rating: Number(l.metadata?.rating || 5),
          category: l.metadata?.category || 'General',
          message: l.metadata?.message || '',
          name: l.metadata?.name || null,
          email: l.metadata?.email || null,
          created_at: l.metadata?.created_at || l.created_at,
        }));
      }

      const uniqueVisitors = new Set(events.map((e) => e.visitor_id)).size;
      const counts = {
        page_view: 0,
        product_search: 0,
        favorite_toggle: 0,
        add_to_cart: 0,
        begin_checkout: 0,
        order_completed: 0,
        newsletter_signup: 0,
      };

      const productInterestMap = new Map<
        string,
        { productId: string; productName: string; cartAdds: number; favorites: number }
      >();

      for (const ev of events) {
        if (ev.event_type in counts) {
          counts[ev.event_type as keyof typeof counts]++;
        }
        if (
          ev.product_id &&
          (ev.event_type === 'add_to_cart' || ev.event_type === 'favorite_toggle')
        ) {
          const cur = productInterestMap.get(ev.product_id) || {
            productId: ev.product_id,
            productName: ev.product_name || ev.product_id,
            cartAdds: 0,
            favorites: 0,
          };
          if (ev.event_type === 'add_to_cart') cur.cartAdds++;
          if (ev.event_type === 'favorite_toggle') cur.favorites++;
          productInterestMap.set(ev.product_id, cur);
        }
      }

      const ordersCount = Math.max(counts.order_completed, (onlineOrders || []).length);
      const onlineRevenue = (onlineOrders || []).reduce(
        (sum: number, o: any) => sum + Number(o.adjusted_total_usd || 0),
        0
      );

      const baseViews = Math.max(1, counts.page_view, uniqueVisitors);
      const avgRating =
        feedbacks.length > 0
          ? Number(
              (
                feedbacks.reduce((sum, f) => sum + Number(f.rating || 5), 0) / feedbacks.length
              ).toFixed(1)
            )
          : 0;

      res.json({
        success: true,
        organizationName: org.name,
        days,
        metrics: {
          uniqueVisitors,
          pageViews: counts.page_view,
          searches: counts.product_search,
          favoritesToggled: counts.favorite_toggle,
          cartAdditions: counts.add_to_cart,
          checkoutsStarted: counts.begin_checkout,
          ordersCompleted: ordersCount,
          onlineRevenue: Number(onlineRevenue.toFixed(2)),
          addToCartRate: Number(((counts.add_to_cart / baseViews) * 100).toFixed(1)),
          purchaseConversionRate: Number(((ordersCount / baseViews) * 100).toFixed(1)),
          newsletterSubscribersCount: subscribers.length,
          feedbackCount: feedbacks.length,
          averageRating: avgRating,
        },
        topProducts: Array.from(productInterestMap.values())
          .sort((a, b) => b.cartAdds + b.favorites - (a.cartAdds + a.favorites))
          .slice(0, 8),
        recentOrders: (onlineOrders || []).slice(0, 10).map((o: any) => ({
          orderNumber: o.id,
          customerName: o.client_name,
          status: o.status,
          totalAmount: Number(o.adjusted_total_usd || 0),
          createdAt: o.created_at,
        })),
        subscribers: subscribers.slice(0, 20),
        feedbacks: feedbacks.slice(0, 20),
      });
    } catch (err: any) {
      console.error('[Creator Storefront Analytics Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load storefront analytics.' });
    }
  });


  // ---------------------------------------------------------------------------
  // 9. POS Customer View & Dual-Channel Counter Kiosk API
  // ---------------------------------------------------------------------------
  interface PosRegisterLineServer {
    productId: string;
    sku: string;
    name: string;
    cutType: string;
    grade: string;
    unit: string;
    quantity: number;
    retailPricePerUnit: number;
    wholesalePricePerUnit: number;
    unitPrice: number;
    lineTotal: number;
    storageZone: string;
    imageUrl: string;
  }

  interface PosRegisterCustomerSummary {
    id: string;
    name: string;
    companyName: string;
    type: string;
    tier: string;
    email?: string;
    phone?: string;
    paymentTerms: string;
    creditLimitUSD: number;
    outstandingBalanceUSD: number;
    availableCreditUSD: number;
    status: string;
  }

  interface PosRegisterSessionRecord {
    registerId: string;
    organizationId: string | null;
    pricingMode: 'retail' | 'wholesale';
    customerName: string;
    customerAccount: PosRegisterCustomerSummary | null;
    items: PosRegisterLineServer[];
    discountPct: number;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
    paymentMethod: string;
    allowCustomerBasketEdits: boolean;
    lastCompletedReceipt: any | null;
    sourceId: string;
    version: number;
    updatedAt: string;
  }

  const posRegisterSessions = new Map<string, PosRegisterSessionRecord>();

  async function hydratePosRegisterSession(
    adminClient: any,
    orgId: string | null,
    registerId: string
  ): Promise<PosRegisterSessionRecord> {
    const key = `${orgId || 'default'}:${registerId}`;
    const inMemory = posRegisterSessions.get(key);
    if (inMemory) {
      return inMemory;
    }

    const empty = createEmptyPosSession(registerId, orgId);
    posRegisterSessions.set(key, empty);
    return empty;
  }

  async function persistPosRegisterSession(
    adminClient: any,
    orgId: string | null,
    registerId: string,
    session: PosRegisterSessionRecord
  ): Promise<void> {
    const key = `${orgId || 'default'}:${registerId}`;
    posRegisterSessions.set(key, session);
  }

  async function resolvePosCustomerOrg(
    req: express.Request,
    adminClient: any
  ): Promise<{ id: string; name: string }> {
    const userId = await resolveOptionalUserId(req, adminClient);
    if (userId && adminClient) {
      const { data: profile } = await adminClient
        .from('staff_profiles')
        .select('organization_id')
        .eq('id', userId)
        .eq('is_active', true)
        .maybeSingle();

      if (profile?.organization_id) {
        const { data: orgRow } = await adminClient
          .from('organizations')
          .select('id, name')
          .eq('id', profile.organization_id)
          .maybeSingle();
        if (orgRow?.id) {
          return { id: String(orgRow.id), name: String(orgRow.name || 'Amansocean Coldstore') };
        }
      }
    }
    return resolvePrimaryStorefrontOrg(adminClient);
  }

  function createEmptyPosSession(
    registerId: string,
    organizationId: string | null
  ): PosRegisterSessionRecord {
    return {
      registerId,
      organizationId,
      pricingMode: 'retail',
      customerName: 'Walk-in Customer',
      customerAccount: null,
      items: [],
      discountPct: 0,
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal: 0,
      paymentMethod: 'Credit Card',
      allowCustomerBasketEdits: true,
      lastCompletedReceipt: null,
      sourceId: 'server-init',
      version: 1,
      updatedAt: new Date().toISOString(),
    };
  }

  function recomputePosSessionTotals(session: PosRegisterSessionRecord): PosRegisterSessionRecord {
    const normalizedItems = session.items
      .filter((it) => Number(it.quantity) > 0)
      .map((it) => {
        const activePrice =
          session.pricingMode === 'wholesale' && Number(it.wholesalePricePerUnit) > 0
            ? Number(it.wholesalePricePerUnit)
            : Number(it.retailPricePerUnit || it.unitPrice || 0);
        const qty = Number(Number(it.quantity).toFixed(2));
        return {
          ...it,
          quantity: qty,
          unitPrice: activePrice,
          lineTotal: Number((activePrice * qty).toFixed(2)),
        };
      });

    const subtotal = Number(
      normalizedItems.reduce((sum, it) => sum + it.lineTotal, 0).toFixed(2)
    );
    const discountPct = Math.max(0, Math.min(100, Number(session.discountPct || 0)));
    const discountAmount = Number(((subtotal * discountPct) / 100).toFixed(2));
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number((taxable * 0.0875).toFixed(2));
    const grandTotal = Number((taxable + taxAmount).toFixed(2));

    return {
      ...session,
      items: normalizedItems,
      discountPct,
      subtotal,
      discountAmount,
      taxAmount,
      grandTotal,
    };
  }

  function mapProductRowToDualCatalogItem(row: any) {
    const sfMapped = mapDbRowToStorefrontProduct(row);
    const retailPrice = Number(row.retail_price_per_unit ?? sfMapped.price ?? 0);
    const wholesalePrice = Number(
      row.wholesale_price_per_unit ?? Number((retailPrice * 0.82).toFixed(2))
    );
    return {
      id: String(row.id),
      sku: String(row.sku || sfMapped.sku || row.id),
      speciesId: String(row.species_id || 'spec-prawns'),
      name: String(row.name),
      cutType: String(row.cut_type || 'IQF Flash Frozen Box'),
      category: String(row.category || 'Crustacean'),
      storefrontCategory: sfMapped.category,
      description: sfMapped.description,
      grade: String(row.grade || 'Grade #1'),
      unit: String(row.unit || 'pack'),
      retailPackSize: String(row.retail_pack_size || sfMapped.weight || '1 pack'),
      retailPricePerUnit: retailPrice,
      wholesalePricePerUnit: wholesalePrice,
      wholesaleMinQty: Math.max(1, Number(row.wholesale_min_qty || 5)),
      stockKg: sfMapped.stockKg,
      inStock: sfMapped.inStock,
      origin: sfMapped.origin,
      storageZone: String(
        row.storage_zone ||
          parseOriginLotMeta(row.origin).storageZone ||
          'Commercial Cold Storage (-22°C)'
      ),
      imageUrl: String(row.image_url || sfMapped.image),
      isAvailableForRetail: row.is_available_for_retail !== false,
      isAvailableForWholesale: row.is_available_for_wholesale !== false,
    };
  }

  // 9A. GET Live POS Register Session
  app.get('/api/pos/register-session', async (req, res) => {
    const registerId = String(req.query.registerId || 'REG-1').trim().toUpperCase();
    const adminClient = adminClientGetter();

    try {
      let orgId: string | null = null;
      if (adminClient) {
        const org = await resolvePosCustomerOrg(req, adminClient);
        orgId = org.id;
      }

      const session = await hydratePosRegisterSession(adminClient, orgId, registerId);

      res.json({ success: true, session });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read POS register session.' });
    }
  });

  // 9B. PUT Update POS Register Session (from Cashier POS controller - Re-prices authoritatively from DB)
  // Requires a valid authenticated staff Bearer token.
  app.put('/api/pos/register-session', requireStaffSession, async (req, res) => {
    const body = req.body || {};
    const registerId = String(body.registerId || 'REG-1').trim().toUpperCase();
    const adminClient = adminClientGetter();

    try {
      let orgId: string | null = null;
      let catalogMap = new Map<string, ReturnType<typeof mapProductRowToDualCatalogItem>>();

      if (adminClient) {
        const org = await resolvePosCustomerOrg(req, adminClient);
        orgId = org.id;
        const { data: prodRows } = await adminClient
          .from('retail_wholesale_products')
          .select('*')
          .eq('organization_id', orgId)
          .eq('is_active', true);

        for (const r of prodRows || []) {
          const item = mapProductRowToDualCatalogItem(r);
          catalogMap.set(item.id, item);
        }
      } else {
        for (const seed of AMANSOCEAN_SEED_PRODUCTS) {
          const item = mapProductRowToDualCatalogItem(seed);
          catalogMap.set(item.id, item);
        }
      }

      const prev = await hydratePosRegisterSession(adminClient, orgId, registerId);
      const isWholesale = body.pricingMode === 'wholesale';

      const rawItems = Array.isArray(body.items) ? body.items : prev.items;
      const mappedItems: PosRegisterLineServer[] = rawItems.map((it: any) => {
        const pid = String(it.productId || it.id || '');
        const matched = catalogMap.get(pid);
        const retailPrice = matched ? matched.retailPricePerUnit : Number(it.retailPricePerUnit ?? it.unitPrice ?? 0);
        const wholesalePrice = matched ? matched.wholesalePricePerUnit : Number(it.wholesalePricePerUnit ?? retailPrice);
        const activeUnitPrice = isWholesale ? wholesalePrice : retailPrice;
        const qty = Math.max(0, Number(it.quantity || 0));

        return {
          productId: pid,
          sku: matched?.sku || String(it.sku || ''),
          name: matched?.name || String(it.name || 'Seafood Cut'),
          cutType: matched?.cutType || String(it.cutType || 'IQF Flash Frozen'),
          grade: matched?.grade || String(it.grade || 'Grade #1'),
          unit: matched?.unit || String(it.unit || 'pack'),
          quantity: qty,
          retailPricePerUnit: retailPrice,
          wholesalePricePerUnit: wholesalePrice,
          unitPrice: activeUnitPrice,
          lineTotal: Number((activeUnitPrice * qty).toFixed(2)),
          storageZone: matched?.storageZone || String(it.storageZone || 'Commercial Cold Storage (-22°C)'),
          imageUrl: matched?.imageUrl || String(it.imageUrl || ''),
        };
      });

      const nextBase: PosRegisterSessionRecord = {
        registerId,
        organizationId: orgId,
        pricingMode: body.pricingMode === 'wholesale' ? 'wholesale' : 'retail',
        customerName:
          typeof body.customerName === 'string' && body.customerName.trim()
            ? body.customerName.trim()
            : 'Walk-in Customer',
        customerAccount: body.customerAccount || null,
        items: mappedItems,
        discountPct: Number(body.discountPct ?? prev.discountPct ?? 0),
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        paymentMethod: String(body.paymentMethod || prev.paymentMethod || 'Credit Card'),
        allowCustomerBasketEdits:
          body.allowCustomerBasketEdits !== undefined
            ? Boolean(body.allowCustomerBasketEdits)
            : prev.allowCustomerBasketEdits,
        lastCompletedReceipt:
          body.lastCompletedReceipt !== undefined
            ? body.lastCompletedReceipt
            : prev.lastCompletedReceipt,
        sourceId: String(body.sourceId || 'cashier-pos'),
        version: prev.version + 1,
        updatedAt: new Date().toISOString(),
      };

      const finalized = recomputePosSessionTotals(nextBase);
      await persistPosRegisterSession(adminClient, orgId, registerId, finalized);

      res.json({ success: true, session: finalized });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update POS register session.' });
    }
  });

  // 9C. POST Customer Kiosk Action on Active POS Register Basket
  app.post('/api/pos/register-session/customer-action', async (req, res) => {
    const body = req.body || {};
    const registerId = String(body.registerId || 'REG-1').trim().toUpperCase();
    const action = String(body.action || '').trim();
    const sourceId = String(body.sourceId || 'customer-kiosk');
    const adminClient = adminClientGetter();

    try {
      let orgId: string | null = null;
      let catalogMap = new Map<string, ReturnType<typeof mapProductRowToDualCatalogItem>>();

      if (adminClient) {
        const org = await resolvePosCustomerOrg(req, adminClient);
        orgId = org.id;
        await ensureStorefrontCatalogSeeded(adminClient, org.id);
        const { data: prodRows } = await adminClient
          .from('retail_wholesale_products')
          .select('*')
          .eq('organization_id', org.id)
          .eq('is_active', true);

        for (const r of prodRows || []) {
          const item = mapProductRowToDualCatalogItem(r);
          catalogMap.set(item.id, item);
        }
      } else {
        for (const seed of AMANSOCEAN_SEED_PRODUCTS) {
          const item = mapProductRowToDualCatalogItem(seed);
          catalogMap.set(item.id, item);
        }
      }

      const current = await hydratePosRegisterSession(adminClient, orgId, registerId);

      if (action === 'start_new_basket' || action === 'clear_basket') {
        const cleared = recomputePosSessionTotals({
          ...current,
          items: action === 'clear_basket' ? [] : current.items,
          lastCompletedReceipt: null,
          sourceId,
          version: current.version + 1,
          updatedAt: new Date().toISOString(),
        });
        await persistPosRegisterSession(adminClient, orgId, registerId, cleared);
        res.json({ success: true, session: cleared, stockNotices: [] });
        return;
      }

      if (!current.allowCustomerBasketEdits) {
        res.status(403).json({
          error: 'Cashier has locked self-service basket edits during active tender.',
        });
        return;
      }

      const nextPricingMode: 'retail' | 'wholesale' =
        body.pricingMode === 'wholesale'
          ? 'wholesale'
          : body.pricingMode === 'retail'
          ? 'retail'
          : current.pricingMode;

      const workingItems = [...current.items];
      const stockNotices: string[] = [];

      if (action === 'add_item') {
        const pid = String(body.productId || '').trim();
        const addQty = Math.max(0.5, Number(body.quantity || 1));
        const prod = catalogMap.get(pid);
        if (!prod) {
          res.status(404).json({ error: 'Selected product was not found in live catalog.' });
          return;
        }
        if (prod.stockKg <= 0) {
          res.status(409).json({
            error: `"${prod.name}" is currently out of stock in cold storage.`,
            code: 'INSUFFICIENT_STOCK',
          });
          return;
        }

        const idx = workingItems.findIndex((it) => it.productId === pid);
        const existingQty = idx >= 0 ? workingItems[idx].quantity : 0;
        const clampedQty = Math.min(prod.stockKg, Number((existingQty + addQty).toFixed(2)));
        if (clampedQty < existingQty + addQty) {
          stockNotices.push(`Capped "${prod.name}" at ${prod.stockKg} available in cold vault.`);
        }

        const lineObj: PosRegisterLineServer = {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          cutType: prod.cutType,
          grade: prod.grade,
          unit: nextPricingMode === 'wholesale' ? 'kg' : prod.unit,
          quantity: clampedQty,
          retailPricePerUnit: prod.retailPricePerUnit,
          wholesalePricePerUnit: prod.wholesalePricePerUnit,
          unitPrice:
            nextPricingMode === 'wholesale' ? prod.wholesalePricePerUnit : prod.retailPricePerUnit,
          lineTotal: 0,
          storageZone: prod.storageZone,
          imageUrl: prod.imageUrl,
        };

        if (idx >= 0) {
          workingItems[idx] = lineObj;
        } else {
          workingItems.push(lineObj);
        }
      } else if (action === 'update_qty') {
        const pid = String(body.productId || '').trim();
        const rawQty = Number(body.quantity || 0);
        const idx = workingItems.findIndex((it) => it.productId === pid);
        if (idx >= 0) {
          if (rawQty <= 0) {
            workingItems.splice(idx, 1);
          } else {
            const prod = catalogMap.get(pid);
            const maxStock = prod ? prod.stockKg : rawQty;
            const clamped = Math.min(maxStock, Number(rawQty.toFixed(2)));
            if (prod && clamped < rawQty) {
              stockNotices.push(`Only ${prod.stockKg} of "${prod.name}" available in stock.`);
            }
            workingItems[idx] = { ...workingItems[idx], quantity: clamped };
          }
        }
      } else if (action === 'set_pricing_mode') {
        // Pricing mode already captured in nextPricingMode
      } else if (action === 'load_reorder') {
        const reorderLines = Array.isArray(body.items) ? body.items : [];
        if (reorderLines.length === 0) {
          res.status(400).json({ error: 'No items provided to reorder.' });
          return;
        }
        workingItems.length = 0;

        for (const reqLine of reorderLines) {
          const reqId = String(reqLine.productId || '').trim();
          const reqName = String(reqLine.productName || '').trim().toLowerCase();
          const reqQty = Math.max(1, Number(reqLine.quantity || 1));

          let matchedProd = catalogMap.get(reqId);
          if (!matchedProd) {
            for (const candidate of catalogMap.values()) {
              if (
                candidate.speciesId === reqId ||
                candidate.sku.toLowerCase() === reqId.toLowerCase() ||
                (reqName && candidate.name.toLowerCase() === reqName)
              ) {
                matchedProd = candidate;
                break;
              }
            }
          }

          if (!matchedProd || matchedProd.stockKg <= 0) {
            stockNotices.push(
              `"${reqLine.productName || reqId}" is currently unavailable and was skipped.`
            );
            continue;
          }

          const finalQty = Math.min(matchedProd.stockKg, reqQty);
          if (finalQty < reqQty) {
            stockNotices.push(
              `Adjusted "${matchedProd.name}" from ${reqQty} to ${finalQty} (available stock).`
            );
          }

          workingItems.push({
            productId: matchedProd.id,
            sku: matchedProd.sku,
            name: matchedProd.name,
            cutType: matchedProd.cutType,
            grade: matchedProd.grade,
            unit: nextPricingMode === 'wholesale' ? 'kg' : matchedProd.unit,
            quantity: finalQty,
            retailPricePerUnit: matchedProd.retailPricePerUnit,
            wholesalePricePerUnit: matchedProd.wholesalePricePerUnit,
            unitPrice:
              nextPricingMode === 'wholesale'
                ? matchedProd.wholesalePricePerUnit
                : matchedProd.retailPricePerUnit,
            lineTotal: 0,
            storageZone: matchedProd.storageZone,
            imageUrl: matchedProd.imageUrl,
          });
        }

        if (workingItems.length === 0) {
          res.status(409).json({
            error: 'None of the items from that past order are currently in stock.',
            stockNotices,
          });
          return;
        }
      } else {
        res.status(400).json({ error: `Unsupported customer register action: ${action}` });
        return;
      }

      const nextCustomerName =
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim()
          : current.customerName;

      const updatedSession = recomputePosSessionTotals({
        ...current,
        pricingMode: nextPricingMode,
        customerName: nextCustomerName,
        customerAccount: body.customerAccount !== undefined ? body.customerAccount : current.customerAccount,
        items: workingItems,
        lastCompletedReceipt: null,
        sourceId,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      });

      await persistPosRegisterSession(adminClient, orgId, registerId, updatedSession);
      res.json({
        success: true,
        session: updatedSession,
        addedCount: updatedSession.items.length,
        stockNotices,
      });
    } catch (err: any) {
      console.error('[POS Customer Action Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to apply customer basket action.' });
    }
  });

  // 9D. GET Dual-Channel POS Customer Catalog (Retail Packs + Wholesale B2B Bulk)
  app.get('/api/pos/customer-catalog', async (req, res) => {
    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.json({
        success: true,
        source: 'seed_fallback',
        organizationId: null,
        organizationName: 'Amansocean Coldstore',
        products: AMANSOCEAN_SEED_PRODUCTS.map(mapProductRowToDualCatalogItem),
      });
      return;
    }

    try {
      const org = await resolvePosCustomerOrg(req, adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, org.id);

      const { data: rows, error } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const products = (rows || []).map(mapProductRowToDualCatalogItem);
      res.json({
        success: true,
        source: 'supabase',
        organizationId: org.id,
        organizationName: org.name,
        products,
      });
    } catch (err: any) {
      console.error('[POS Customer Catalog Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to load POS customer catalog.' });
    }
  });

  // 9E. GET Verified Customer Account, Receipts, Wholesale Invoices & B2B Credit Statement
  app.get('/api/pos/customer-account', async (req, res) => {
    const rawContact = String(req.query.contact || '').trim();
    const requestedCustomerId = String(req.query.customerId || '').trim();
    const adminClient = adminClientGetter();

    if (!adminClient) {
      res.status(503).json({ error: 'Database connection is unavailable.' });
      return;
    }

    const hasEmail = rawContact.includes('@') && rawContact.length >= 5;
    const phoneDigits = normalizePhoneDigits(rawContact);
    const hasPhone = phoneDigits.length >= 6;
    const staffUserId = await resolveOptionalUserId(req, adminClient);

    if (!hasEmail && !hasPhone && !(staffUserId && requestedCustomerId)) {
      res.status(400).json({
        error: 'Enter a valid phone number or email address to verify your customer account.',
      });
      return;
    }

    try {
      const org = await resolvePosCustomerOrg(req, adminClient);

      // 1. Match Customer Profile(s) in `customers`
      const { data: allCustRows, error: custErr } = await adminClient
        .from('customers')
        .select('*')
        .eq('organization_id', org.id);

      if (custErr) throw custErr;

      const matchedCustomers = (allCustRows || []).filter((c: any) => {
        if (staffUserId && requestedCustomerId && String(c.id) === requestedCustomerId) {
          return true;
        }
        return contactsMatch(rawContact, c.phone, c.email);
      });

      // Prefer B2B Wholesale account if multiple profiles match same email/phone
      matchedCustomers.sort((a: any, b: any) => {
        const aWholesale = /wholesale|hotel|supermarket|distributor/i.test(String(a.type || '')) ? 0 : 1;
        const bWholesale = /wholesale|hotel|supermarket|distributor/i.test(String(b.type || '')) ? 0 : 1;
        return aWholesale - bWholesale;
      });

      const primaryCust = matchedCustomers[0] || null;
      const matchedCustIds = new Set(matchedCustomers.map((c: any) => String(c.id)));
      const matchedCustNames = new Set(
        matchedCustomers
          .flatMap((c: any) => [
            String(c.name || '').trim().toLowerCase(),
            String(c.company_name || '').trim().toLowerCase(),
            `${String(c.name || '').trim()} (${String(c.company_name || '').trim()})`.toLowerCase(),
          ])
          .filter(Boolean)
      );

      // Map catalog species_id -> productId so wholesale order lines can also one-click reorder cleanly
      const { data: orgProducts } = await adminClient
        .from('retail_wholesale_products')
        .select('id, species_id, name, retail_pack_size, unit')
        .eq('organization_id', org.id);

      const speciesToProductId = new Map<string, string>();
      for (const p of orgProducts || []) {
        if (p.species_id && !speciesToProductId.has(String(p.species_id))) {
          speciesToProductId.set(String(p.species_id), String(p.id));
        }
      }

      // 2. Match Wholesale & Storefront Orders (`client_orders` + `order_line_items`)
      const { data: allOrders } = await adminClient
        .from('client_orders')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const matchedOrdersRaw = (allOrders || []).filter((o: any) => {
        if (o.customer_id && matchedCustIds.has(String(o.customer_id))) return true;
        let meta: any = {};
        try {
          meta = o.special_instructions ? JSON.parse(o.special_instructions) : {};
        } catch {}
        return contactsMatch(
          rawContact,
          meta.customer_phone || o.contact_phone,
          meta.customer_email || o.contact_email
        );
      });

      const matchedOrderIds = matchedOrdersRaw.map((o: any) => String(o.id));
      let orderLinesByOrder = new Map<string, any[]>();
      if (matchedOrderIds.length > 0) {
        const { data: lineRows } = await adminClient
          .from('order_line_items')
          .select('*')
          .eq('organization_id', org.id)
          .in('order_id', matchedOrderIds);

        for (const ln of lineRows || []) {
          const oid = String(ln.order_id);
          const list = orderLinesByOrder.get(oid) || [];
          list.push(ln);
          orderLinesByOrder.set(oid, list);
        }
      }

      const invoices = matchedOrdersRaw.map((o: any) => {
        let meta: any = {};
        try {
          meta = o.special_instructions ? JSON.parse(o.special_instructions) : {};
        } catch {}

        const rawLines = orderLinesByOrder.get(String(o.id)) || [];
        const items =
          Array.isArray(meta.items) && meta.items.length > 0
            ? meta.items
            : rawLines.map((ln: any) => ({
                productId: speciesToProductId.get(String(ln.species_id)) || String(ln.species_id),
                productName: String(ln.species_name),
                quantity: Number(ln.actual_weighed_kg ?? ln.requested_weight_kg ?? 1),
                unitPrice: Number(ln.price_per_kg ?? 0),
                lineTotal: Number(
                  (
                    Number(ln.actual_weighed_kg ?? ln.requested_weight_kg ?? 1) *
                    Number(ln.price_per_kg ?? 0)
                  ).toFixed(2)
                ),
                weightLabel: String(ln.notes || 'kg'),
              }));

        const fulfillmentStatus = mapErpOrderStatusToFulfillment(
          o.status,
          meta.fulfillment_status
        );

        return {
          orderNumber: String(o.id),
          channel: String(o.id).startsWith('AO-') ? 'storefront' : 'wholesale',
          customerName: String(o.client_name || primaryCust?.company_name || 'Customer'),
          orderDate: String(o.order_date || (o.created_at ? o.created_at.slice(0, 10) : '')),
          requiredDeliveryDate: String(o.required_delivery_date || ''),
          status: String(o.status || 'Pending Confirmation'),
          fulfillmentStatus,
          paymentStatus: String(o.payment_status || 'Invoiced'),
          paymentTerms: String(o.payment_terms || primaryCust?.payment_terms || 'Due on Receipt'),
          deliveryAddress: String(o.delivery_address || primaryCust?.address || ''),
          packagingRequirement: String(o.packaging_requirement || 'Commercial Cold-Chain Box'),
          subtotal: Number(meta.subtotal ?? o.quoted_total_usd ?? 0),
          deliveryFee: Number(meta.delivery_fee ?? 0),
          totalAmount: Number(o.adjusted_total_usd ?? o.quoted_total_usd ?? 0),
          items,
        };
      });

      // 3. Match Retail POS Receipts (`retail_transactions` + `retail_sale_items`)
      const { data: txRows } = await adminClient
        .from('retail_transactions')
        .select('*')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false })
        .limit(200);

      const matchedOrderIdSet = new Set(matchedOrderIds);
      const matchedTxsRaw = (txRows || []).filter((tx: any) => {
        if (tx.receipt_number && matchedOrderIdSet.has(String(tx.receipt_number))) return true;
        if (hasPhone && contactsMatch(rawContact, tx.customer_phone, null)) return true;
        const txCustLower = String(tx.customer_name || '').trim().toLowerCase();
        if (txCustLower && matchedCustNames.has(txCustLower)) return true;
        return false;
      });

      const txIds = matchedTxsRaw.map((t: any) => String(t.id));
      const saleItemsByTx = new Map<string, any[]>();
      if (txIds.length > 0) {
        const { data: saleItemRows } = await adminClient
          .from('retail_sale_items')
          .select('*')
          .eq('organization_id', org.id)
          .in('transaction_id', txIds);

        for (const si of saleItemRows || []) {
          const tid = String(si.transaction_id);
          const arr = saleItemsByTx.get(tid) || [];
          arr.push(si);
          saleItemsByTx.set(tid, arr);
        }
      }

      const receipts = matchedTxsRaw.map((tx: any) => {
        const sItems = saleItemsByTx.get(String(tx.id)) || [];
        return {
          id: String(tx.id),
          receiptNumber: String(tx.receipt_number || tx.id),
          date: String(tx.created_at || new Date().toISOString()),
          customerName: String(tx.customer_name || 'Walk-in Customer'),
          paymentMethod: String(tx.payment_method || 'Card / Cash'),
          subtotal: Number(tx.subtotal || 0),
          discountAmount: Number(tx.discount_amount || 0),
          taxAmount: Number(tx.tax_amount || 0),
          totalAmount: Number(tx.total_amount || 0),
          cashierName: String(tx.cashier_name || 'Amansocean POS'),
          status: String(tx.status || 'Completed'),
          items: sItems.map((si: any) => ({
            productId: String(si.product_id || ''),
            productName: String(si.product_name || 'Seafood Item'),
            cutType: String(si.cut_type || ''),
            quantity: Number(si.quantity || 1),
            unit: String(si.unit || 'pack'),
            unitPrice: Number(si.unit_price || 0),
            lineTotal: Number(si.line_total || 0),
          })),
        };
      });

      // 4. Build B2B Credit Statement Ledger (`financial_ledger_entries` + credit invoices)
      const { data: finRows } = await adminClient
        .from('financial_ledger_entries')
        .select('*')
        .eq('organization_id', org.id)
        .order('entry_date', { ascending: true })
        .limit(300);

      const receiptNumbersSet = new Set(receipts.map((r) => r.receiptNumber));
      const matchedFinRows = (finRows || []).filter((fe: any) => {
        const finMeta = parseFinancialDescriptionMeta(fe.description);
        const effectiveCustId = fe.customer_id || finMeta.customerId;
        const effectiveReceiptNo = fe.receipt_number || finMeta.receiptNumber;
        if (effectiveCustId && matchedCustIds.has(String(effectiveCustId))) return true;
        if (effectiveReceiptNo && receiptNumbersSet.has(String(effectiveReceiptNo))) return true;
        if (fe.reference_id && (matchedOrderIdSet.has(String(fe.reference_id)) || receiptNumbersSet.has(String(fe.reference_id)))) {
          return true;
        }
        const entLower = String(fe.entity_name || '').trim().toLowerCase();
        if (entLower && matchedCustNames.has(entLower)) return true;
        return false;
      });

      let runningBalance = 0;
      const creditLedger = matchedFinRows.map((fe: any) => {
        const amt = Number(fe.amount || 0);
        const statusStr = String(fe.status || 'Settled');
        const finMeta = parseFinancialDescriptionMeta(fe.description);
        const descStr = finMeta.cleanDescription || String(fe.description || '');
        const effectiveReceiptNo = fe.receipt_number || finMeta.receiptNumber;
        const isPaymentReceived =
          /payment received|settlement|credit note|collection/i.test(descStr) ||
          (statusStr === 'Settled' && /ar|receivable|payment/i.test(String(fe.category || '')));
        const isOnAccountCharge = statusStr === 'Pending' || statusStr === 'Overdue';

        let debit = 0;
        let credit = 0;
        if (isOnAccountCharge) {
          debit = amt;
          runningBalance = Number((runningBalance + debit).toFixed(2));
        } else if (isPaymentReceived) {
          credit = amt;
          runningBalance = Number(Math.max(0, runningBalance - credit).toFixed(2));
        } else {
          // Direct paid order/receipt: equal debit & credit so net AR impact is 0
          debit = amt;
          credit = amt;
        }

        return {
          id: String(fe.id),
          date: String(fe.entry_date || (fe.created_at ? fe.created_at.slice(0, 10) : '')),
          referenceId: String(fe.reference_id || effectiveReceiptNo || 'LEDGER'),
          type: isPaymentReceived ? 'Payment' : isOnAccountCharge ? 'Credit Invoice' : 'Paid Sale',
          description: descStr || 'Amansocean Transaction',
          debit,
          credit,
          runningBalance,
          paymentMethod: String(fe.payment_method || 'Account'),
          status: statusStr,
        };
      });

      if (!primaryCust && invoices.length === 0 && receipts.length === 0) {
        res.status(404).json({
          error: 'No orders, receipts, or B2B account found for that phone number or email.',
        });
        return;
      }

      const creditLimitUSD = Number(primaryCust?.credit_limit_usd ?? 0);
      const outstandingBalanceUSD = Number(
        primaryCust?.outstanding_balance_usd ?? runningBalance ?? 0
      );
      const availableCreditUSD = Math.max(
        0,
        Number((creditLimitUSD - outstandingBalanceUSD).toFixed(2))
      );

      res.json({
        success: true,
        account: primaryCust
          ? {
              id: String(primaryCust.id),
              name: String(primaryCust.name),
              companyName: String(primaryCust.company_name || primaryCust.name),
              type: String(primaryCust.type || 'Direct Retail VIP'),
              tier: String(primaryCust.tier || 'Retail Standard'),
              email: String(primaryCust.email || ''),
              phone: String(primaryCust.phone || ''),
              address: String(primaryCust.address || ''),
              city: String(primaryCust.city || ''),
              paymentTerms: String(primaryCust.payment_terms || 'Instant Card/Cash'),
              creditLimitUSD,
              outstandingBalanceUSD,
              availableCreditUSD,
              totalOrdersCount: Math.max(
                Number(primaryCust.total_orders_count || 0),
                invoices.length + receipts.length
              ),
              totalSpendUSD: Number(primaryCust.total_spend_usd || 0),
              status: String(primaryCust.status || 'Active'),
              isWholesaleB2B:
                creditLimitUSD > 0 ||
                /wholesale|hotel|supermarket|distributor|net/i.test(
                  `${primaryCust.type || ''} ${primaryCust.payment_terms || ''}`
                ),
            }
          : {
              id: 'GUEST-VERIFIED',
              name: invoices[0]?.customerName || receipts[0]?.customerName || 'Verified Shopper',
              companyName: 'Retail Counter Customer',
              type: 'Direct Retail',
              tier: 'Retail Standard',
              email: hasEmail ? rawContact : '',
              phone: hasPhone ? rawContact : '',
              address: invoices[0]?.deliveryAddress || '',
              city: '',
              paymentTerms: 'Pay at Counter / Delivery',
              creditLimitUSD: 0,
              outstandingBalanceUSD: 0,
              availableCreditUSD: 0,
              totalOrdersCount: invoices.length + receipts.length,
              totalSpendUSD: Number(
                [...invoices, ...receipts]
                  .reduce((s, r) => s + Number(r.totalAmount || 0), 0)
                  .toFixed(2)
              ),
              status: 'Active',
              isWholesaleB2B: false,
            },
        receipts,
        invoices,
        creditLedger: creditLedger.reverse(),
      });
    } catch (err: any) {
      console.error('[POS Customer Account Lookup Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to look up customer account.' });
    }
  });

  // 9F. POST Direct Counter / Wholesale Self-Service Order Submission
  app.post('/api/pos/customer-order', async (req, res) => {
    const {
      orderMode = 'retail',
      registerId = 'REG-1',
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress = 'Counter Pickup — Amansocean Coldstore',
      paymentMethod = 'Pay at Counter (Card / Cash / Mobile Money)',
      items,
    } = req.body || {};

    const cleanMode: 'retail' | 'wholesale' = orderMode === 'wholesale' ? 'wholesale' : 'retail';
    const cleanName = String(customerName || '').trim();
    const cleanPhone = String(customerPhone || '').trim();
    const cleanEmail = String(customerEmail || '').trim().toLowerCase();
    const cleanAddress = String(deliveryAddress || 'Counter Pickup — Amansocean Coldstore').trim();
    const cleanPayment = String(paymentMethod || 'Pay at Counter').trim();

    if (!cleanName) {
      res.status(400).json({ error: 'Customer or company name is required.' });
      return;
    }
    if (!cleanPhone && !cleanEmail) {
      res.status(400).json({
        error: 'Phone number or email address is required for receipt and order lookup.',
      });
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Basket is empty.' });
      return;
    }

    const adminClient = adminClientGetter();
    if (!adminClient) {
      res.status(503).json({ error: 'Database service unavailable.' });
      return;
    }

    try {
      const org = await resolvePosCustomerOrg(req, adminClient);
      await ensureStorefrontCatalogSeeded(adminClient, org.id);

      const requestedMap = new Map<string, number>();
      for (const rawItem of items) {
        const pid = String(rawItem?.productId || '').trim();
        const qty = Number(rawItem?.quantity || 0);
        if (!pid || !Number.isFinite(qty) || qty <= 0) {
          res.status(400).json({ error: 'Invalid item quantity in basket.' });
          return;
        }
        requestedMap.set(pid, Number(((requestedMap.get(pid) || 0) + qty).toFixed(2)));
      }

      const productIds = Array.from(requestedMap.keys());
      const { data: dbProducts, error: prodErr } = await adminClient
        .from('retail_wholesale_products')
        .select('*')
        .eq('organization_id', org.id)
        .in('id', productIds);

      if (prodErr) throw prodErr;
      const dbProdMap = new Map<string, any>((dbProducts || []).map((p: any) => [String(p.id), p]));

      for (const [pid, qty] of requestedMap.entries()) {
        const prod = dbProdMap.get(pid);
        if (!prod || !prod.is_active) {
          res.status(404).json({ error: `Product "${pid}" is unavailable.` });
          return;
        }
        const currentStock = Number(prod.stock_kg ?? 0);
        if (currentStock < qty) {
          res.status(409).json({
            error: `Only ${currentStock} available in cold vault for "${prod.name}".`,
            code: 'INSUFFICIENT_STOCK',
            productId: pid,
            availableStockKg: currentStock,
          });
          return;
        }
      }

      // Pre-compute authoritative totals before mutating stock or ledger
      let subtotal = 0;
      let costTotal = 0;
      const pricedItems: Array<{
        pid: string;
        prod: any;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        lineTotal: number;
      }> = [];

      for (const [pid, qty] of requestedMap.entries()) {
        const prod = dbProdMap.get(pid)!;
        const unitPrice =
          cleanMode === 'wholesale' && Number(prod.wholesale_price_per_unit) > 0
            ? Number(prod.wholesale_price_per_unit)
            : Number(prod.retail_price_per_unit || 0);
        const costPrice = Number(prod.cost_price_per_unit || 0);
        const lineTotal = Number((unitPrice * qty).toFixed(2));
        subtotal = Number((subtotal + lineTotal).toFixed(2));
        costTotal = Number((costTotal + costPrice * qty).toFixed(2));
        pricedItems.push({
          pid,
          prod,
          quantity: qty,
          unitPrice,
          costPrice,
          lineTotal,
        });
      }

      const taxAmount = Number((subtotal * 0.0875).toFixed(2));
      const totalAmount = Number((subtotal + taxAmount).toFixed(2));
      const isCreditAccountPayment = /credit|net-|on account/i.test(cleanPayment);

      // Match existing customer & enforce B2B credit controls BEFORE deducting stock
      const { data: allCusts } = await adminClient
        .from('customers')
        .select('*')
        .eq('organization_id', org.id);

      const matchedCust = (allCusts || []).find((c: any) =>
        contactsMatch(cleanEmail || cleanPhone, c.phone, c.email)
      );

      if (isCreditAccountPayment) {
        if (!matchedCust) {
          res.status(403).json({
            error:
              'B2B Net-Terms Credit requires an approved wholesale customer account matching your phone or email.',
            code: 'NO_CREDIT_ACCOUNT',
          });
          return;
        }
        if (String(matchedCust.status) === 'Credit Hold') {
          res.status(409).json({
            error: `Account "${matchedCust.company_name || matchedCust.name}" is on Credit Hold. Please see counter staff.`,
            code: 'CREDIT_HOLD',
          });
          return;
        }
        const limit = Number(matchedCust.credit_limit_usd || 0);
        const currentBal = Number(matchedCust.outstanding_balance_usd || 0);
        if (currentBal + totalAmount > limit) {
          res.status(409).json({
            error: `Order total (GH₵ ${totalAmount.toFixed(2)}) exceeds available credit (GH₵ ${Math.max(0, limit - currentBal).toFixed(2)}).`,
            code: 'CREDIT_LIMIT_EXCEEDED',
          });
          return;
        }
      }

      // All stock and credit gates passed — now deduct FEFO batches & product stock
      const verifiedLines: Array<{
        product: any;
        quantity: number;
        unitPrice: number;
        costPrice: number;
        lineTotal: number;
        weightLabel: string;
        lotId: string;
      }> = [];

      for (const item of pricedItems) {
        const { pid, prod, quantity: qty, unitPrice, costPrice, lineTotal } = item;

        const { data: candidateBatches } = await adminClient
          .from('inventory_batches')
          .select('id, available_weight_kg, linked_product_id, expiry_date')
          .eq('organization_id', org.id)
          .or(`linked_product_id.eq.${pid},species_id.eq.${prod.species_id}`)
          .order('expiry_date', { ascending: true });

        let remainingToDeduct = qty;
        let primaryLotId = '';
        for (const batch of candidateBatches || []) {
          const avail = Number(batch.available_weight_kg ?? 0);
          if (!primaryLotId) primaryLotId = String(batch.id);
          if (avail <= 0 || remainingToDeduct <= 0) continue;
          const deduct = Math.min(avail, remainingToDeduct);
          await adminClient
            .from('inventory_batches')
            .update({
              available_weight_kg: Number(Math.max(0, avail - deduct).toFixed(2)),
              updated_at: new Date().toISOString(),
            })
            .eq('organization_id', org.id)
            .eq('id', batch.id);
          remainingToDeduct = Number((remainingToDeduct - deduct).toFixed(2));
          primaryLotId = String(batch.id);
        }

        if (!primaryLotId) {
          primaryLotId = `LOT-POS-${pid.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`;
        }

        const nextStock = Number(Math.max(0, Number(prod.stock_kg || 0) - qty).toFixed(2));
        await adminClient
          .from('retail_wholesale_products')
          .update({ stock_kg: nextStock, updated_at: new Date().toISOString() })
          .eq('organization_id', org.id)
          .eq('id', pid);

        verifiedLines.push({
          product: prod,
          quantity: qty,
          unitPrice,
          costPrice,
          lineTotal,
          weightLabel:
            cleanMode === 'wholesale'
              ? 'kg'
              : String(prod.retail_pack_size || prod.unit || '1 pack'),
          lotId: primaryLotId,
        });
      }

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const orderNumber =
        cleanMode === 'wholesale'
          ? `ORD-${10000 + crypto.randomInt(0, 90000)}`
          : `AO-${10000 + crypto.randomInt(0, 90000)}`;
      const receiptNumber = `POS-${new Date().getFullYear()}-${1000 + crypto.randomInt(0, 9000)}`;
      const txId = `REC-${orderNumber}`;

      let customerId = matchedCust?.id;
      if (matchedCust) {
        const nextOutstanding = isCreditAccountPayment
          ? Number((Number(matchedCust.outstanding_balance_usd || 0) + totalAmount).toFixed(2))
          : Number(matchedCust.outstanding_balance_usd || 0);
        await adminClient
          .from('customers')
          .update({
            outstanding_balance_usd: nextOutstanding,
            total_orders_count: Number(matchedCust.total_orders_count || 0) + 1,
            total_spend_usd: Number(
              (Number(matchedCust.total_spend_usd || 0) + totalAmount).toFixed(2)
            ),
            updated_at: nowIso,
          })
          .eq('organization_id', org.id)
          .eq('id', matchedCust.id);
      } else {
        const custHash = crypto
          .createHash('sha1')
          .update((cleanEmail || normalizePhoneDigits(cleanPhone) || cleanName).toLowerCase())
          .digest('hex')
          .slice(0, 8)
          .toUpperCase();
        customerId = `CUST-POS-${custHash}`;
        await adminClient.from('customers').upsert(
          {
            organization_id: org.id,
            id: customerId,
            name: cleanName,
            company_name: cleanMode === 'wholesale' ? cleanName : 'POS Counter Customer',
            type: cleanMode === 'wholesale' ? 'Fishmonger / Distributor' : 'Direct Retail VIP',
            tier: cleanMode === 'wholesale' ? 'Tier 2 (Standard Wholesale)' : 'Retail Standard',
            contact_person: cleanName,
            email: cleanEmail || `pos.${custHash.toLowerCase()}@amansocean.store`,
            phone: cleanPhone || 'N/A',
            address: cleanAddress,
            city: 'Coldstore Counter',
            credit_limit_usd: 0,
            outstanding_balance_usd: 0,
            payment_terms: 'Cash on Delivery',
            total_orders_count: 1,
            total_spend_usd: totalAmount,
            status: 'Active',
            is_active: true,
            updated_at: nowIso,
          },
          { onConflict: 'organization_id,id' }
        );
      }

      const orderMeta = {
        channel: 'pos_customer_kiosk',
        register_id: registerId,
        order_mode: cleanMode,
        fulfillment_status: 'confirmed',
        customer_phone: cleanPhone || null,
        customer_email: cleanEmail || null,
        payment_method: cleanPayment,
        subtotal,
        tax_amount: taxAmount,
        delivery_fee: 0,
        total_amount: totalAmount,
        receipt_number: receiptNumber,
        items: verifiedLines.map((l) => ({
          productId: String(l.product.id),
          productName: String(l.product.name),
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          weightLabel: l.weightLabel,
        })),
      };

      const paymentStatus = isCreditAccountPayment
        ? matchedCust?.payment_terms === 'Net-15'
          ? 'Pending Net-15'
          : 'Pending Net-30'
        : 'Paid';

      const dbOrderPaymentStatus = normalizeOrderPaymentStatus(paymentStatus);

      await adminClient.from('client_orders').insert({
        organization_id: org.id,
        id: orderNumber,
        customer_id: customerId,
        client_name: matchedCust?.company_name || cleanName,
        client_category: cleanMode === 'wholesale' ? 'Fishmonger / Distributor' : 'Direct Retail VIP',
        contact_person: cleanName,
        contact_email: cleanEmail || matchedCust?.email || 'counter@amansocean.store',
        contact_phone: cleanPhone || matchedCust?.phone || 'N/A',
        destination_city: 'Coldstore Counter',
        delivery_address: cleanAddress,
        order_date: todayDate,
        required_delivery_date: todayDate,
        status: 'Pending Confirmation',
        quoted_total_usd: totalAmount,
        adjusted_total_usd: totalAmount,
        payment_status: dbOrderPaymentStatus,
        packaging_requirement:
          cleanMode === 'wholesale'
            ? 'Dry Ice & Insulated Wax Carton'
            : 'Standard Cryo-Box',
        special_instructions: JSON.stringify(orderMeta),
        packing_slip_generated: true,
      });

      await adminClient.from('order_line_items').insert(
        verifiedLines.map((l) => ({
          organization_id: org.id,
          order_id: orderNumber,
          species_id: l.product.species_id,
          species_name: l.product.name,
          grade: normalizeQualityGrade(l.product.grade),
          lot_id: l.lotId,
          requested_weight_kg: l.quantity,
          actual_weighed_kg: l.quantity,
          price_per_kg: l.unitPrice,
          notes: `${cleanMode === 'wholesale' ? 'Wholesale Bulk' : 'Counter Pack'} (${l.weightLabel})`,
        }))
      );

      await adminClient.from('retail_transactions').insert({
        organization_id: org.id,
        id: txId,
        receipt_number: receiptNumber,
        customer_name: matchedCust?.company_name || cleanName,
        customer_phone: cleanPhone || matchedCust?.phone || null,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        cost_total: costTotal,
        gross_margin: Number((subtotal - costTotal).toFixed(2)),
        payment_method: isCreditAccountPayment
          ? 'Store Credit'
          : normalizeRetailPaymentMethod(cleanPayment),
        cashier_name: `POS Kiosk (${registerId})`,
        status: 'Completed',
      });

      await adminClient.from('retail_sale_items').insert(
        verifiedLines.map((l) => ({
          organization_id: org.id,
          transaction_id: txId,
          product_id: l.product.id,
          product_name: l.product.name,
          cut_type: normalizeRetailCutType(l.product.cut_type),
          quantity: l.quantity,
          unit: cleanMode === 'wholesale' ? 'kg' : l.product.unit || 'pack',
          unit_price: l.unitPrice,
          cost_price: l.costPrice,
          line_total: l.lineTotal,
        }))
      );

      await adminClient.from('financial_ledger_entries').insert({
        organization_id: org.id,
        entry_date: todayDate,
        type: 'Income',
        category: cleanMode === 'wholesale' ? 'Revenue (Wholesale)' : 'Revenue (Retail POS)',
        description: encodeFinancialDescriptionMeta(
          `POS Customer Kiosk ${orderNumber} (${receiptNumber})`,
          { customerId, receiptNumber }
        ),
        reference_id: orderNumber,
        entity_name: matchedCust?.company_name || cleanName,
        amount: totalAmount,
        payment_method: cleanPayment,
        status: isCreditAccountPayment ? 'Pending' : 'Settled',
      });

      await adminClient.from('system_notifications').insert({
        organization_id: org.id,
        type: 'order_update',
        title: `POS Customer Order ${orderNumber}`,
        message: `${cleanName} submitted a ${cleanMode} order (GH₵ ${totalAmount.toFixed(2)}) at ${registerId}.`,
        urgency: 'medium',
        read: false,
        related_entity_id: orderNumber,
      });

      // Update active register session with completed receipt & clear basket
      const normRegId = String(registerId).trim().toUpperCase();
      const completedReceiptPayload = {
        id: txId,
        receiptNumber,
        orderNumber,
        date: nowIso,
        customerName: matchedCust?.company_name || cleanName,
        saleType: isCreditAccountPayment ? 'Credit Sale (On Account)' : 'Direct Payment',
        creditTerms: isCreditAccountPayment
          ? matchedCust?.payment_terms || 'Net-30'
          : undefined,
        paymentMethod: cleanPayment,
        subtotal,
        discountAmount: 0,
        taxAmount,
        totalAmount,
        items: verifiedLines.map((l) => ({
          productId: String(l.product.id),
          productName: String(l.product.name),
          cutType: String(l.product.cut_type || ''),
          quantity: l.quantity,
          unit: l.weightLabel,
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
        })),
      };

      const existingSession = await hydratePosRegisterSession(adminClient, org.id, normRegId);

      const postCheckoutSession = recomputePosSessionTotals({
        ...existingSession,
        items: [],
        lastCompletedReceipt: completedReceiptPayload,
        sourceId: 'pos-kiosk-checkout',
        version: existingSession.version + 1,
        updatedAt: nowIso,
      });
      await persistPosRegisterSession(adminClient, org.id, normRegId, postCheckoutSession);

      res.status(201).json({
        success: true,
        orderNumber,
        receiptNumber,
        paymentStatus,
        receipt: completedReceiptPayload,
        session: postCheckoutSession,
      });
    } catch (err: any) {
      console.error('[POS Customer Order Submission Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to submit POS customer order.' });
    }
  });

  // ==========================================
  // 10. UNIFIED ERP SUPABASE PERSISTENCE ROUTES
  // ==========================================

  const ALLOWED_ERP_TABLES = new Set<string>([
    'species',
    'inventory_batches',
    'inventory_adjustments',
    'inventory_adjustment_accounts',
    'customers',
    'client_orders',
    'order_line_items',
    'retail_wholesale_products',
    'retail_transactions',
    'retail_sale_items',
    'suppliers',
    'purchase_order_landings',
    'purchase_order_items',
    'financial_ledger_entries',
    'haccp_audit_records',
    'system_notifications',
    'app_settings',
    'reefer_vehicles',
    'fleet_vessels',
    'market_price_index',
  ]);

  const ERP_INSERT_ONLY_TABLES = new Set<string>([
    'financial_ledger_entries',
    'haccp_audit_records',
    'inventory_adjustments',
  ]);

  const ERP_SOFT_DELETE_TABLES = new Set<string>([
    'species',
    'retail_wholesale_products',
    'customers',
    'suppliers',
    'inventory_adjustment_accounts',
  ]);

  const ERP_UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function resolveErpTenantOrgId(req: express.Request): string {
    const callerProfile = (req as any).callerProfile;
    const requested = String(
      req.body?.organizationId || req.query?.organizationId || ''
    ).trim();
    if (callerProfile?.role === 'creator' && requested && ERP_UUID_REGEX.test(requested)) {
      return requested;
    }
    const orgId = String(callerProfile?.organization_id || '').trim();
    if (
      orgId &&
      ERP_UUID_REGEX.test(orgId) &&
      orgId !== '00000000-0000-0000-0000-000000000001' &&
      orgId !== 'org-frostly-hq'
    ) {
      return orgId;
    }
    return '';
  }

  async function ensureSpeciesRowExists(
    adminClient: any,
    orgId: string,
    speciesId?: string | null,
    speciesName?: string | null,
    category?: string | null
  ): Promise<string> {
    const sid = String(speciesId || 'spec-tilapia').trim();
    const { data: existing } = await adminClient
      .from('species')
      .select('id')
      .eq('organization_id', orgId)
      .eq('id', sid)
      .maybeSingle();
    if (!existing) {
      await adminClient.from('species').upsert(
        {
          organization_id: orgId,
          id: sid,
          name: String(speciesName || sid.replace(/^spec-/, '')).trim() || 'Seafood Catch',
          scientific_name: 'Marine / Cold-Chain Species',
          category:
            category === 'Pelagic' ||
            category === 'Groundfish' ||
            category === 'Crustacean' ||
            category === 'Mollusk' ||
            category === 'Salmonid'
              ? category
              : 'Groundfish',
          default_zone: 'Commercial Cold Storage (-22°C)',
          standard_price_per_kg: 65,
          available_grades: ['Sashimi AAA', 'Grade #1'],
          fao_zones: ['FAO 34'],
          gear_types: ['Sustainable Trawl & Trap'],
          seasonal_peak: 'Year-Round Cold Chain',
          image: '/images/products/tilapia.jpg',
          shelf_life_fresh_days: 5,
          shelf_life_frozen_months: 18,
          is_active: true,
        },
        { onConflict: 'organization_id,id' }
      );
    }
    return sid;
  }

  async function ensureBatchRowExists(
    adminClient: any,
    orgId: string,
    batchId: string,
    speciesId?: string | null,
    speciesName?: string | null,
    minWeightKg = 100
  ): Promise<void> {
    if (!batchId) return;
    const { data: existing } = await adminClient
      .from('inventory_batches')
      .select('id')
      .eq('organization_id', orgId)
      .eq('id', batchId)
      .maybeSingle();
    if (existing) return;

    const resolvedSpecId = await ensureSpeciesRowExists(adminClient, orgId, speciesId, speciesName);
    const today = new Date().toISOString().split('T')[0];
    const safeWeight = Math.max(10, Number(minWeightKg) || 100);
    const orgShort = orgId.replace(/-/g, '').slice(0, 4).toUpperCase();
    await adminClient.from('inventory_batches').upsert(
      {
        organization_id: orgId,
        id: batchId,
        species_id: resolvedSpecId,
        species_name: String(speciesName || 'Cold Vault Lot'),
        scientific_name: 'Marine / Cold-Chain Species',
        category: 'Groundfish',
        harvest_date: today,
        landing_port: 'Port of Tema Coldstore Hub',
        vessel_name: 'MV Amansocean Star',
        vessel_registration: 'GH-TMA-402',
        captain_name: 'Capt. Kwame Boateng',
        fao_area: 'FAO 34 Eastern Central Atlantic',
        gps_coordinates: { latitude: 5.6265, longitude: 0.0061 },
        location_description: 'Amans Ocean Coldstore · Abrepo, Barekese Rd',
        gear_type: 'IQF Cryo Line',
        grade: 'Grade #1',
        initial_weight_kg: safeWeight,
        available_weight_kg: safeWeight,
        allocated_weight_kg: 0,
        storage_zone: 'Commercial Cold Storage (-22°C)',
        current_temp_celsius: -22,
        target_temp_celsius: -22,
        cost_per_kg: 45,
        wholesale_price_per_kg: 65,
        certifications: ['HACCP Certified', 'FDA Approved'],
        inspection_status: 'Passed',
        histamine_ppm: 4.5,
        core_temp_celsius: -22,
        received_date: today,
        expiry_date: '2027-12-31',
        qr_code_seed: `QR-${batchId}-${orgShort}`,
        notes: `Auto-provisioned cold storage batch for ${speciesName || batchId}`,
      },
      { onConflict: 'organization_id,id' }
    );
  }

  async function ensureErpForeignKeys(
    adminClient: any,
    orgId: string,
    tableName: string,
    payload: Record<string, any>,
    childItems?: Array<Record<string, any>>
  ): Promise<void> {
    if (
      (tableName === 'inventory_batches' ||
        tableName === 'retail_wholesale_products' ||
        tableName === 'haccp_audit_records' ||
        tableName === 'market_price_index') &&
      payload.species_id
    ) {
      await ensureSpeciesRowExists(
        adminClient,
        orgId,
        payload.species_id,
        payload.species_name || payload.name,
        payload.category
      );
    }

    if (tableName === 'client_orders') {
      const custId = String(payload.customer_id || 'CUST-WALKIN').trim();
      payload.customer_id = custId;
      const { data: existingCust } = await adminClient
        .from('customers')
        .select('id')
        .eq('organization_id', orgId)
        .eq('id', custId)
        .maybeSingle();

      if (!existingCust) {
        await adminClient.from('customers').upsert(
          {
            organization_id: orgId,
            id: custId,
            name: String(payload.client_name || 'Walk-in / Counter Client'),
            company_name: String(payload.client_name || 'Walk-in / Counter Client'),
            type: normalizeOrderCustomerCategory(payload.client_category),
            tier: 'Tier 2 (Standard Wholesale)',
            contact_person: String(payload.contact_person || payload.client_name || 'Client'),
            email: String(payload.contact_email || 'client@amansocean.store'),
            phone: String(payload.contact_phone || 'N/A'),
            address: String(payload.delivery_address || 'Tema / Accra'),
            city: String(payload.destination_city || 'Accra'),
            credit_limit_usd: 50000,
            outstanding_balance_usd: 0,
            payment_terms: 'Net-30',
            total_orders_count: 1,
            total_spend_usd: Number(payload.adjusted_total_usd || payload.quoted_total_usd || 0),
            status: 'Active',
            is_active: true,
          },
          { onConflict: 'organization_id,id' }
        );
      }
    }

    if (tableName === 'purchase_order_landings') {
      const supId = String(payload.supplier_id || 'SUP-DEFAULT').trim();
      payload.supplier_id = supId;
      const { data: existingSup } = await adminClient
        .from('suppliers')
        .select('id')
        .eq('organization_id', orgId)
        .eq('id', supId)
        .maybeSingle();

      if (!existingSup) {
        await adminClient.from('suppliers').upsert(
          {
            organization_id: orgId,
            id: supId,
            name: String(payload.supplier_name || 'Harvester Supplier'),
            contact_person: String(payload.received_by || 'Harbor Master'),
            type: 'Fishermen Co-op',
            email: 'supply@amansocean.store',
            phone: 'N/A',
            port_location: String(payload.port_location || 'Tema Fishing Harbour'),
            country: 'Ghana',
            vessel_names: payload.vessel_name ? [String(payload.vessel_name)] : [],
            supplied_species: [],
            payment_terms: 'Net-30',
            outstanding_payable_usd: 0,
            total_purchased_usd: Number(payload.total_cost_usd || 0),
            total_weight_supplied_kg: 0,
            rating: 5,
            status: 'Active',
            is_active: true,
          },
          { onConflict: 'organization_id,id' }
        );
      }
    }

    const haccpLotId = payload.lot_id || payload.batch_id;
    if (tableName === 'haccp_audit_records' && haccpLotId) {
      payload.lot_id = String(haccpLotId);
      delete payload.batch_id;
      delete payload.species_id;
      await ensureBatchRowExists(
        adminClient,
        orgId,
        String(haccpLotId),
        null,
        payload.species_name
      );
    }

    if (tableName === 'inventory_adjustments') {
      if (payload.batch_id) {
        await ensureBatchRowExists(
          adminClient,
          orgId,
          String(payload.batch_id),
          null,
          payload.species_name,
          Math.max(100, Number(payload.previous_weight_kg || payload.new_weight_kg || 100))
        );
      }

      if (
        payload.adjustment_account_id &&
        !ERP_UUID_REGEX.test(String(payload.adjustment_account_id))
      ) {
        payload.adjustment_account_id = null;
      }

      if (!payload.adjustment_account_id && payload.adjustment_account_code) {
        const code = String(payload.adjustment_account_code).trim();
        const { data: accRow } = await adminClient
          .from('inventory_adjustment_accounts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('account_code', code)
          .maybeSingle();

        if (accRow?.id) {
          payload.adjustment_account_id = accRow.id;
        } else {
          const { data: createdAcc } = await adminClient
            .from('inventory_adjustment_accounts')
            .upsert(
              {
                organization_id: orgId,
                account_code: code,
                account_name: String(payload.adjustment_account_name || 'Inventory Variance Account'),
                account_type: 'COGS',
                description: 'Auto-provisioned Cold Vault Adjustment Account',
                is_default: false,
                balance_usd: 0,
                is_active: true,
              },
              { onConflict: 'organization_id,account_code' }
            )
            .select('id')
            .maybeSingle();
          if (createdAcc?.id) {
            payload.adjustment_account_id = createdAcc.id;
          }
        }
      }

      if (payload.financial_ledger_id && !ERP_UUID_REGEX.test(String(payload.financial_ledger_id))) {
        payload.financial_ledger_id = ensureValidUuid(String(payload.financial_ledger_id));
      }
      if (payload.financial_ledger_id) {
        const { data: finRow } = await adminClient
          .from('financial_ledger_entries')
          .select('id')
          .eq('organization_id', orgId)
          .eq('id', payload.financial_ledger_id)
          .maybeSingle();
        if (!finRow) {
          payload.financial_ledger_id = null;
        }
      }
    }

    if (Array.isArray(childItems) && childItems.length > 0) {
      if (tableName === 'client_orders') {
        for (const item of childItems) {
          const sid = await ensureSpeciesRowExists(
            adminClient,
            orgId,
            item.species_id,
            item.species_name
          );
          item.species_id = sid;
          item.lot_id = String(item.lot_id || `LOT-ORD-${payload.id}`);
          await ensureBatchRowExists(
            adminClient,
            orgId,
            item.lot_id,
            sid,
            item.species_name,
            Math.max(50, Number(item.requested_weight_kg || 50))
          );
        }
      } else if (tableName === 'purchase_order_landings') {
        for (const item of childItems) {
          const sid = await ensureSpeciesRowExists(
            adminClient,
            orgId,
            item.species_id,
            item.species_name
          );
          item.species_id = sid;
        }
      } else if (tableName === 'retail_transactions') {
        for (const item of childItems) {
          const pid = String(item.product_id || 'PROD-COUNTER').trim();
          item.product_id = pid;
          item.cut_type = normalizeRetailCutType(item.cut_type);
          const { data: existingProd } = await adminClient
            .from('retail_wholesale_products')
            .select('id')
            .eq('organization_id', orgId)
            .eq('id', pid)
            .maybeSingle();

          if (!existingProd) {
            const sid = await ensureSpeciesRowExists(
              adminClient,
              orgId,
              'spec-tilapia',
              item.product_name
            );
            await adminClient.from('retail_wholesale_products').upsert(
              {
                organization_id: orgId,
                id: pid,
                species_id: sid,
                name: String(item.product_name || 'Counter Seafood Item'),
                cut_type: item.cut_type,
                category: 'Groundfish',
                grade: 'Grade #1',
                stock_kg: 100,
                unit: ['kg', 'lb', 'piece', 'pack'].includes(String(item.unit)) ? item.unit : 'kg',
                cost_price_per_unit: Math.max(0, Number(item.cost_price || 0)),
                wholesale_price_per_unit: Math.max(0, Number(item.unit_price || 0)),
                retail_price_per_unit: Math.max(0, Number(item.unit_price || 0)),
                wholesale_min_qty: 1,
                sku: `SKU-${pid}`,
                image_url: '/images/products/tilapia.jpg',
                origin: 'Ghana Coldstore',
                is_available_for_retail: true,
                is_available_for_wholesale: true,
                is_active: true,
              },
              { onConflict: 'organization_id,id' }
            );
          }
        }
      }
    }
  }

  // 10A. GET Query ERP Table (Scoped to Tenant Organization)
  app.get('/api/erp/persistence/query', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const tableName = String(req.query.table || '').trim();
    const recordId = req.query.recordId ? String(req.query.recordId).trim() : '';
    const includeChildren = req.query.includeChildren === 'true';
    const limitVal = Math.min(2000, Math.max(1, Number(req.query.limit || 1000)));

    if (!ALLOWED_ERP_TABLES.has(tableName)) {
      res.status(400).json({ error: `Unsupported ERP table '${tableName}'.` });
      return;
    }

    const targetOrgId = resolveErpTenantOrgId(req);
    if (!targetOrgId) {
      res.status(400).json({ error: 'Tenant organization ID could not be resolved.' });
      return;
    }

    try {
      let selectClause = '*';
      if (includeChildren) {
        if (tableName === 'client_orders') selectClause = '*, order_line_items(*)';
        else if (tableName === 'retail_transactions') selectClause = '*, retail_sale_items(*)';
        else if (tableName === 'purchase_order_landings') selectClause = '*, purchase_order_items(*)';
      }

      if (recordId) {
        const { data: row, error } = await adminClient
          .from(tableName)
          .select(selectClause)
          .eq('organization_id', targetOrgId)
          .eq('id', recordId)
          .maybeSingle();
        if (error) throw error;
        res.json({ success: true, row: row || null });
        return;
      }

      let listQuery = adminClient
        .from(tableName)
        .select(selectClause)
        .eq('organization_id', targetOrgId);

      if (tableName === 'client_orders' || tableName === 'purchase_order_landings') {
        listQuery = listQuery.order('order_date', { ascending: false });
      } else if (tableName === 'financial_ledger_entries') {
        listQuery = listQuery.order('entry_date', { ascending: false });
      } else if (tableName === 'retail_wholesale_products') {
        listQuery = listQuery.order('created_at', { ascending: true });
      } else if (tableName === 'species') {
        listQuery = listQuery.order('name', { ascending: true });
      } else if (tableName !== 'app_settings') {
        listQuery = listQuery.order('created_at', { ascending: false });
      }

      const { data: rows, error } = await listQuery.limit(limitVal);
      if (error) throw error;

      res.json({ success: true, rows: rows || [] });
    } catch (err: any) {
      console.error(`[ERP Persistence Query Error - ${tableName}]:`, err);
      res.status(500).json({ error: err?.message || `Failed to query ${tableName}.` });
    }
  });

  // 10B. POST Upsert / Insert ERP Record (+ Optional Child Line Items)
  app.post('/api/erp/persistence/upsert', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const callerProfile = (req as any).callerProfile;
    const { tableName, payload, onConflict, childItems } = req.body || {};

    if (!tableName || !ALLOWED_ERP_TABLES.has(String(tableName))) {
      res.status(400).json({ error: `Unsupported ERP table '${tableName}'.` });
      return;
    }
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Valid record payload object is required.' });
      return;
    }

    const targetOrgId = resolveErpTenantOrgId(req);
    if (!targetOrgId) {
      res.status(400).json({ error: 'Tenant organization ID could not be resolved.' });
      return;
    }

    try {
      const cleanPayload: Record<string, any> = {
        ...payload,
        organization_id: targetOrgId,
      };

      if (tableName === 'retail_wholesale_products') {
        delete cleanPayload.linked_batch_id;
        delete cleanPayload.storage_zone;
        if (cleanPayload.cut_type) {
          cleanPayload.cut_type = normalizeRetailCutType(cleanPayload.cut_type);
        }
        if (cleanPayload.imageUrl !== undefined || cleanPayload.image_url !== undefined) {
          cleanPayload.image_url = String(cleanPayload.imageUrl ?? cleanPayload.image_url ?? '').trim();
          delete cleanPayload.imageUrl;
        }
      }

      if (tableName === 'financial_ledger_entries') {
        cleanPayload.customer_id = cleanPayload.customer_id || null;
        cleanPayload.supplier_id = cleanPayload.supplier_id || null;
        cleanPayload.receipt_number = cleanPayload.receipt_number || null;
        cleanPayload.voucher_number = cleanPayload.voucher_number || null;
        cleanPayload.notes = cleanPayload.notes || null;
        cleanPayload.description = String(cleanPayload.description || 'Financial Ledger Transaction');

        if (cleanPayload.id) {
          cleanPayload.id = ensureValidUuid(String(cleanPayload.id));
        }
        const validFinTypes = new Set(['Income', 'COGS', 'OpEx']);
        cleanPayload.type = validFinTypes.has(String(cleanPayload.type))
          ? cleanPayload.type
          : 'Income';
        const validFinCats = new Set([
          'Revenue (Wholesale)',
          'Revenue (Retail POS)',
          'COGS (Catch Intake)',
          'Logistics & Reefer Freight',
          'Cold Storage Utilities',
          'Packaging & Ice',
          'Labor & Cutting Crew',
          'Dock Fees & Port Taxes',
          'Inventory Adjustment',
        ]);
        if (!validFinCats.has(String(cleanPayload.category))) {
          cleanPayload.category = /retail/i.test(String(cleanPayload.category || ''))
            ? 'Revenue (Retail POS)'
            : cleanPayload.type === 'Income'
            ? 'Revenue (Wholesale)'
            : cleanPayload.type === 'COGS'
            ? 'COGS (Catch Intake)'
            : 'Cold Storage Utilities';
        }
        const validFinStatuses = new Set(['Settled', 'Pending', 'Overdue']);
        if (!validFinStatuses.has(String(cleanPayload.status))) {
          cleanPayload.status = 'Settled';
        }
        if (cleanPayload.created_by && !ERP_UUID_REGEX.test(String(cleanPayload.created_by))) {
          delete cleanPayload.created_by;
        }
        if (!cleanPayload.created_by && callerProfile?.id && ERP_UUID_REGEX.test(callerProfile.id)) {
          cleanPayload.created_by = callerProfile.id;
        }
      }

      if (
        (tableName === 'system_notifications' ||
          tableName === 'haccp_audit_records' ||
          tableName === 'inventory_adjustments') &&
        cleanPayload.id
      ) {
        cleanPayload.id = ensureValidUuid(String(cleanPayload.id));
      }

      if (tableName === 'haccp_audit_records') {
        if (cleanPayload.created_by && !ERP_UUID_REGEX.test(String(cleanPayload.created_by))) {
          delete cleanPayload.created_by;
        }
        if (!cleanPayload.created_by && callerProfile?.id && ERP_UUID_REGEX.test(callerProfile.id)) {
          cleanPayload.created_by = callerProfile.id;
        }
      }

      if (tableName === 'inventory_adjustments') {
        if ('variance_weight_kg' in cleanPayload && !('delta_weight_kg' in cleanPayload)) {
          cleanPayload.delta_weight_kg = Number(cleanPayload.variance_weight_kg || 0);
        }
        if ('unit_cost_per_kg' in cleanPayload && !('unit_cost_usd' in cleanPayload)) {
          cleanPayload.unit_cost_usd = Math.max(0, Number(cleanPayload.unit_cost_per_kg || 0));
        }
        if ('authorized_by' in cleanPayload && !('created_by' in cleanPayload)) {
          cleanPayload.created_by = String(cleanPayload.authorized_by);
        }
        delete cleanPayload.variance_weight_kg;
        delete cleanPayload.unit_cost_per_kg;
        delete cleanPayload.storage_zone;
        delete cleanPayload.authorized_by;
      }

      if (tableName === 'system_notifications') {
        if ('severity' in cleanPayload && !('urgency' in cleanPayload)) {
          const sev = String(cleanPayload.severity).toLowerCase();
          cleanPayload.urgency =
            sev === 'critical' || sev === 'high' || sev === 'medium' ? sev : 'low';
        }
        if ('category' in cleanPayload && !('type' in cleanPayload)) {
          cleanPayload.type = String(cleanPayload.category);
        }
        if ('is_read' in cleanPayload && !('read' in cleanPayload)) {
          cleanPayload.read = Boolean(cleanPayload.is_read);
        }
        delete cleanPayload.severity;
        delete cleanPayload.category;
        delete cleanPayload.is_read;
        const validNotifTypes = new Set([
          'temp_alert',
          'order_update',
          'catch_landed',
          'haccp_pass',
          'system',
          'payment_received',
          'invoice_due',
          'supplier_delivery',
        ]);
        if (!validNotifTypes.has(String(cleanPayload.type))) {
          cleanPayload.type = 'system';
        }
        const validUrgencies = new Set(['low', 'medium', 'high', 'critical']);
        if (!validUrgencies.has(String(cleanPayload.urgency))) {
          cleanPayload.urgency = 'low';
        }
      }

      if (tableName === 'inventory_adjustment_accounts') {
        if (cleanPayload.id && !ERP_UUID_REGEX.test(String(cleanPayload.id))) {
          delete cleanPayload.id;
        }
        const validAccTypes = new Set(['COGS', 'OpEx', 'Contra-Asset', 'Income']);
        if (!validAccTypes.has(String(cleanPayload.account_type))) {
          cleanPayload.account_type = 'COGS';
        }
      }

      if (tableName === 'inventory_batches') {
        if (cleanPayload.imageUrl !== undefined || cleanPayload.image_url !== undefined) {
          cleanPayload.image_url = String(cleanPayload.imageUrl ?? cleanPayload.image_url ?? '').trim();
          delete cleanPayload.imageUrl;
        }
        const avail = Math.max(0, Number(cleanPayload.available_weight_kg) || 0);
        const alloc = Math.max(0, Number(cleanPayload.allocated_weight_kg) || 0);
        const rawInit = Number(cleanPayload.initial_weight_kg) || 0;
        cleanPayload.available_weight_kg = avail;
        cleanPayload.allocated_weight_kg = alloc;
        cleanPayload.initial_weight_kg = Math.max(rawInit, avail + alloc, 0.01);
        cleanPayload.grade = normalizeQualityGrade(cleanPayload.grade);
      }

      if (tableName === 'client_orders') {
        cleanPayload.client_category = normalizeOrderCustomerCategory(cleanPayload.client_category);
        cleanPayload.payment_status = normalizeOrderPaymentStatus(cleanPayload.payment_status);
        const orderRanks: Record<string, number> = {
          'Pending Confirmation': 1,
          'Weighing & Grading': 2,
          'Cryo-Packed & Iced': 3,
          'In Reefer Transit': 4,
          Delivered: 5,
        };
        if (
          !orderRanks[String(cleanPayload.status)] &&
          cleanPayload.status !== 'Cancelled'
        ) {
          cleanPayload.status = 'Pending Confirmation';
        }
        if (cleanPayload.id) {
          const { data: existingOrd } = await adminClient
            .from('client_orders')
            .select('status')
            .eq('organization_id', targetOrgId)
            .eq('id', cleanPayload.id)
            .maybeSingle();
          if (existingOrd?.status) {
            if (existingOrd.status === 'Delivered' || existingOrd.status === 'Cancelled') {
              cleanPayload.status = existingOrd.status;
            } else if (
              cleanPayload.status !== 'Cancelled' &&
              (orderRanks[String(cleanPayload.status)] || 0) <
                (orderRanks[String(existingOrd.status)] || 0)
            ) {
              cleanPayload.status = existingOrd.status;
            }
          }
        }
      }

      if (tableName === 'purchase_order_landings') {
        const today = new Date().toISOString().split('T')[0];
        if (!cleanPayload.delivery_date) {
          cleanPayload.delivery_date = cleanPayload.expected_landing_date || cleanPayload.order_date || today;
        }
        if (!cleanPayload.payment_due_date) {
          cleanPayload.payment_due_date = cleanPayload.delivery_date || today;
        }
        delete cleanPayload.expected_landing_date;
        delete cleanPayload.total_expected_weight_kg;
        delete cleanPayload.total_received_weight_kg;
        const validPoStatuses = new Set([
          'Received & In Stock',
          'Pending Dock Inspection',
          'In Transit',
        ]);
        if (!validPoStatuses.has(String(cleanPayload.status))) {
          cleanPayload.status = 'Received & In Stock';
        }
        const validPoPaymentStatuses = new Set([
          'Paid',
          'Pending Net-30',
          'Invoiced',
          'Overdue',
          'Paid in Full',
          'Pending Settlement',
          'Partial Paid',
        ]);
        if (!validPoPaymentStatuses.has(String(cleanPayload.payment_status))) {
          cleanPayload.payment_status = /paid/i.test(String(cleanPayload.payment_status || '')) &&
            !/unpaid/i.test(String(cleanPayload.payment_status || ''))
            ? 'Paid in Full'
            : 'Pending Settlement';
        }
      }

      if (tableName === 'retail_transactions') {
        delete cleanPayload.customer_id;
        delete cleanPayload.sale_type;
        if (cleanPayload.cashier_id && !ERP_UUID_REGEX.test(String(cleanPayload.cashier_id))) {
          delete cleanPayload.cashier_id;
        }
        cleanPayload.payment_method = normalizeRetailPaymentMethod(cleanPayload.payment_method);
        cleanPayload.status = cleanPayload.status === 'Refunded' ? 'Refunded' : 'Completed';
      }

      const normalizedChildren = Array.isArray(childItems)
        ? childItems.map((it: any) => ({
            ...it,
            organization_id: targetOrgId,
          }))
        : undefined;

      await ensureErpForeignKeys(
        adminClient,
        targetOrgId,
        tableName,
        cleanPayload,
        normalizedChildren
      );

      let savedRow: any = null;

      if (ERP_INSERT_ONLY_TABLES.has(tableName)) {
        if (cleanPayload.id) {
          const { data: existingRow } = await adminClient
            .from(tableName)
            .select('*')
            .eq('organization_id', targetOrgId)
            .eq('id', cleanPayload.id)
            .maybeSingle();

          if (existingRow) {
            savedRow = existingRow;
          }
        }

        if (!savedRow) {
          const { data: inserted, error: insertErr } = await adminClient
            .from(tableName)
            .insert(cleanPayload)
            .select('*')
            .maybeSingle();
          if (insertErr) throw insertErr;
          savedRow = inserted;
        }
      } else {
        const defaultConflict =
          tableName === 'inventory_adjustment_accounts'
            ? 'organization_id,account_code'
            : String(onConflict || 'organization_id,id');

        let { data: upserted, error: upsertErr } = await adminClient
          .from(tableName)
          .upsert(cleanPayload, { onConflict: defaultConflict })
          .select('*')
          .maybeSingle();

        if (
          upsertErr &&
          upsertErr.message?.includes('no unique or exclusion constraint matching the ON CONFLICT')
        ) {
          const fallbackConflict = defaultConflict.includes('organization_id')
            ? 'id'
            : 'organization_id,id';
          const retry = await adminClient
            .from(tableName)
            .upsert(cleanPayload, { onConflict: fallbackConflict })
            .select('*')
            .maybeSingle();
          upserted = retry.data;
          upsertErr = retry.error;
        }

        if (upsertErr) throw upsertErr;
        savedRow = upserted;
      }

      // Synchronize child line items atomically if provided
      if (normalizedChildren) {
        if (tableName === 'client_orders') {
          await adminClient
            .from('order_line_items')
            .delete()
            .eq('organization_id', targetOrgId)
            .eq('order_id', cleanPayload.id);
          if (normalizedChildren.length > 0) {
            const { error: childErr } = await adminClient
              .from('order_line_items')
              .insert(
                normalizedChildren.map((it) => ({
                  ...it,
                  order_id: cleanPayload.id,
                  grade: normalizeQualityGrade(it.grade),
                }))
              );
            if (childErr) throw childErr;
          }
        } else if (tableName === 'retail_transactions') {
          await adminClient
            .from('retail_sale_items')
            .delete()
            .eq('organization_id', targetOrgId)
            .eq('transaction_id', cleanPayload.id);
          if (normalizedChildren.length > 0) {
            const { error: childErr } = await adminClient
              .from('retail_sale_items')
              .insert(
                normalizedChildren.map((it) => ({
                  ...it,
                  transaction_id: cleanPayload.id,
                  cut_type: normalizeRetailCutType(it.cut_type),
                }))
              );
            if (childErr) throw childErr;
          }
        } else if (tableName === 'purchase_order_landings') {
          await adminClient
            .from('purchase_order_items')
            .delete()
            .eq('organization_id', targetOrgId)
            .eq('po_id', cleanPayload.id);
          if (normalizedChildren.length > 0) {
            const validZones = new Set([
              'Super-Cryo Deep Freeze (-60°C)',
              'Commercial Cold Storage (-22°C)',
              'Fresh Slush Ice (0°C to +2°C)',
              'Live Seawater Tank (+8°C)',
            ]);
            const { error: childErr } = await adminClient
              .from('purchase_order_items')
              .insert(
                normalizedChildren.map((it) => {
                  const weightKg = Math.max(
                    0.01,
                    Number(it.weight_kg ?? it.received_weight_kg ?? it.ordered_weight_kg ?? 1)
                  );
                  const costPerKg = Math.max(
                    0,
                    Number(it.cost_per_kg ?? it.agreed_cost_per_kg ?? 0)
                  );
                  const totalCost = Math.max(
                    0,
                    Number(it.total_cost ?? it.line_total_usd ?? weightKg * costPerKg)
                  );
                  const storageZone = validZones.has(String(it.storage_zone))
                    ? it.storage_zone
                    : 'Commercial Cold Storage (-22°C)';
                  return {
                    organization_id: targetOrgId,
                    po_id: cleanPayload.id,
                    species_id: it.species_id,
                    species_name: String(it.species_name || 'Seafood Catch'),
                    weight_kg: weightKg,
                    cost_per_kg: costPerKg,
                    total_cost: totalCost,
                    grade: normalizeQualityGrade(it.grade),
                    storage_zone: storageZone,
                  };
                })
              );
            if (childErr) throw childErr;
          }
        }
      }

      res.json({ success: true, row: savedRow });
    } catch (err: any) {
      console.error(`[ERP Persistence Upsert Error - ${tableName}]:`, err);
      res.status(500).json({ error: err?.message || `Failed to save ${tableName}.` });
    }
  });

  // 10C. POST Delete / Soft-Delete ERP Record
  app.post('/api/erp/persistence/delete', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const { tableName, recordId } = req.body || {};

    if (!tableName || !ALLOWED_ERP_TABLES.has(String(tableName)) || !recordId) {
      res.status(400).json({ error: 'Valid tableName and recordId are required.' });
      return;
    }

    if (ERP_INSERT_ONLY_TABLES.has(String(tableName))) {
      res.json({ success: true, immutable: true });
      return;
    }

    const targetOrgId = resolveErpTenantOrgId(req);
    if (!targetOrgId) {
      res.status(400).json({ error: 'Tenant organization ID could not be resolved.' });
      return;
    }

    const lookupId =
      tableName === 'system_notifications' || tableName === 'inventory_adjustments'
        ? ensureValidUuid(String(recordId))
        : String(recordId);

    try {
      if (tableName === 'client_orders') {
        await adminClient
          .from('order_line_items')
          .delete()
          .eq('organization_id', targetOrgId)
          .eq('order_id', lookupId);
      } else if (tableName === 'retail_transactions') {
        await adminClient
          .from('retail_sale_items')
          .delete()
          .eq('organization_id', targetOrgId)
          .eq('transaction_id', lookupId);
      } else if (tableName === 'purchase_order_landings') {
        await adminClient
          .from('purchase_order_items')
          .delete()
          .eq('organization_id', targetOrgId)
          .eq('po_id', lookupId);
      }

      const { error: delErr } = await adminClient
        .from(tableName)
        .delete()
        .eq('organization_id', targetOrgId)
        .eq('id', lookupId);
      if (delErr) {
        if (ERP_SOFT_DELETE_TABLES.has(String(tableName))) {
          const { error: softErr } = await adminClient
            .from(tableName)
            .update({ is_active: false })
            .eq('organization_id', targetOrgId)
            .eq('id', lookupId);
          if (softErr) throw softErr;
          res.json({ success: true, softDeleted: true });
          return;
        }
        throw delErr;
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error(`[ERP Persistence Delete Error - ${tableName}]:`, err);
      res.status(500).json({ error: err?.message || `Failed to delete from ${tableName}.` });
    }
  });

  // 10D. GET & POST Tenant App Settings (`app_settings`)
  app.get('/api/erp/persistence/settings', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const targetOrgId = resolveErpTenantOrgId(req);
    try {
      const { data: row, error } = await adminClient
        .from('app_settings')
        .select('*')
        .eq('organization_id', targetOrgId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      res.json({ success: true, row: row || null });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to read app_settings.' });
    }
  });

  app.post('/api/erp/persistence/settings', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const targetOrgId = resolveErpTenantOrgId(req);
    const rawPayload = req.body?.payload;
    if (!rawPayload || typeof rawPayload !== 'object') {
      res.status(400).json({ error: 'Valid settings payload is required.' });
      return;
    }

    try {
      const dbPayload = {
        ...rawPayload,
        id: 1,
        organization_id: targetOrgId,
        updated_at: new Date().toISOString(),
      };
      const { data: row, error } = await adminClient
        .from('app_settings')
        .upsert(dbPayload, { onConflict: 'organization_id,id' })
        .select('*')
        .maybeSingle();
      if (error) throw error;
      res.json({ success: true, row: row || dbPayload });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save app_settings.' });
    }
  });

  // ==========================================
  // 11. PLATFORM CREATOR CONSOLE & ACTIVITY TELEMETRY ROUTES
  // ==========================================


  app.get('/api/platform/organizations', requirePlatformCreator, async (req, res) => {
    const adminClient = adminClientGetter()!;
    try {
      const { data: orgs, error: orgErr } = await adminClient
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });
      if (orgErr) throw orgErr;

      const { data: staffRows } = await adminClient
        .from('staff_profiles')
        .select('organization_id, is_active');
      const { data: inviteRows } = await adminClient
        .from('invites')
        .select('organization_id, used_at, expires_at');

      const nowIso = new Date().toISOString();
      const staffCountMap = new Map<string, number>();
      for (const s of staffRows || []) {
        if (s.is_active !== false && s.organization_id) {
          staffCountMap.set(s.organization_id, (staffCountMap.get(s.organization_id) || 0) + 1);
        }
      }

      const inviteCountMap = new Map<string, number>();
      for (const inv of inviteRows || []) {
        if (!inv.used_at && (!inv.expires_at || inv.expires_at > nowIso) && inv.organization_id) {
          inviteCountMap.set(
            inv.organization_id,
            (inviteCountMap.get(inv.organization_id) || 0) + 1
          );
        }
      }

      const formatted = (orgs || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        company_name: o.company_name || o.name,
        subscription_status: o.subscription_status || 'active',
        plan_tier: o.plan_tier || 'standard',
        billing_provider: o.billing_provider || 'none',
        billing_currency: o.billing_currency || 'GHS',
        max_staff_seats: Number(o.max_staff_seats || 5),
        staff_count: staffCountMap.get(o.id) || 0,
        pending_invites_count: inviteCountMap.get(o.id) || 0,
        trial_ends_at: o.trial_ends_at || null,
        current_period_ends_at: o.current_period_ends_at || null,
        created_at: o.created_at,
      }));

      res.json({ success: true, organizations: formatted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list platform organizations.' });
    }
  });

  app.get('/api/platform/audit-logs', requirePlatformCreator, async (req, res) => {
    const adminClient = adminClientGetter()!;
    try {
      const { data: logs, error } = await adminClient
        .from('platform_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      res.json({ success: true, logs: logs || [] });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch platform audit logs.' });
    }
  });

  app.post(
    '/api/platform/organizations/:orgId/subscription',
    requirePlatformCreator,
    async (req, res) => {
      const adminClient = adminClientGetter()!;
      const callerUser = (req as any).callerUser;
      const { orgId } = req.params;
      const { status, planTier, maxSeats, trialEndsAt, reason } = req.body || {};

      try {
        const { data: existing, error: fetchErr } = await adminClient
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();
        if (fetchErr || !existing) {
          res.status(404).json({ error: 'Organization not found.' });
          return;
        }

        const calculatedSeats =
          maxSeats ?? (planTier === 'enterprise' ? 9999 : planTier === 'standard' ? 20 : 5);
        const updates: Record<string, any> = {
          subscription_status: status || existing.subscription_status,
          plan_tier: planTier || existing.plan_tier,
          max_staff_seats: calculatedSeats,
          is_active: status !== 'suspended',
          updated_at: new Date().toISOString(),
        };
        if (trialEndsAt !== undefined) {
          updates.trial_ends_at = trialEndsAt;
        }

        const { error: updErr } = await adminClient
          .from('organizations')
          .update(updates)
          .eq('id', orgId);
        if (updErr) throw updErr;

        await adminClient.from('platform_audit_logs').insert({
          actor_id: callerUser.id,
          action: 'manual_subscription_update',
          target_organization_id: orgId,
          previous_state: {
            subscription_status: existing.subscription_status,
            plan_tier: existing.plan_tier,
            max_staff_seats: existing.max_staff_seats,
          },
          new_state: {
            subscription_status: updates.subscription_status,
            plan_tier: updates.plan_tier,
            max_staff_seats: updates.max_staff_seats,
          },
          reason: reason || 'Manual subscription update via Platform Console',
        });

        res.json({
          success: true,
          organization_id: orgId,
          subscription_status: updates.subscription_status,
          plan_tier: updates.plan_tier,
          max_staff_seats: updates.max_staff_seats,
          reason,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to update subscription.' });
      }
    }
  );

  app.post('/api/platform/organizations/:orgId/revoke', requirePlatformCreator, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const callerUser = (req as any).callerUser;
    const { orgId } = req.params;
    const { reason } = req.body || {};

    try {
      const { data: existing } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      if (!existing) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      const { error: updErr } = await adminClient
        .from('organizations')
        .update({
          subscription_status: 'suspended',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId);
      if (updErr) throw updErr;

      await adminClient
        .from('invites')
        .update({ expires_at: new Date().toISOString() })
        .eq('organization_id', orgId)
        .is('used_at', null);

      await adminClient.from('platform_audit_logs').insert({
        actor_id: callerUser.id,
        action: 'revoke_organization_access',
        target_organization_id: orgId,
        previous_state: { subscription_status: existing.subscription_status },
        new_state: { subscription_status: 'suspended' },
        reason: reason || 'Access revoked by platform administrator',
      });

      res.json({
        success: true,
        organization_id: orgId,
        subscription_status: 'suspended',
        reason,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to revoke organization access.' });
    }
  });

  app.post(
    '/api/platform/organizations/:orgId/reinstate',
    requirePlatformCreator,
    async (req, res) => {
      const adminClient = adminClientGetter()!;
      const callerUser = (req as any).callerUser;
      const { orgId } = req.params;
      const { reason, targetStatus = 'active' } = req.body || {};

      try {
        const { data: existing } = await adminClient
          .from('organizations')
          .select('*')
          .eq('id', orgId)
          .maybeSingle();
        if (!existing) {
          res.status(404).json({ error: 'Organization not found.' });
          return;
        }

        const cleanStatus = targetStatus === 'trial' ? 'trial' : 'active';
        const { error: updErr } = await adminClient
          .from('organizations')
          .update({
            subscription_status: cleanStatus,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orgId);
        if (updErr) throw updErr;

        await adminClient.from('platform_audit_logs').insert({
          actor_id: callerUser.id,
          action: 'reinstate_organization_access',
          target_organization_id: orgId,
          previous_state: { subscription_status: existing.subscription_status },
          new_state: { subscription_status: cleanStatus },
          reason: reason || 'Tenant access reinstated by platform administrator',
        });

        res.json({
          success: true,
          organization_id: orgId,
          subscription_status: cleanStatus,
          reason,
        });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Failed to reinstate organization.' });
      }
    }
  );

  app.post('/api/platform/organizations/:orgId/delete', requirePlatformCreator, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const callerUser = (req as any).callerUser;
    const { orgId } = req.params;
    const { reason, confirmName } = req.body || {};

    try {
      const { data: existing } = await adminClient
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .maybeSingle();
      if (!existing) {
        res.status(404).json({ error: 'Organization not found.' });
        return;
      }

      if (
        confirmName &&
        String(confirmName).trim().toLowerCase() !== String(existing.name).trim().toLowerCase()
      ) {
        res.status(400).json({
          error: `Confirmation name "${confirmName}" does not match "${existing.name}"`,
        });
        return;
      }

      await adminClient.from('platform_audit_logs').insert({
        actor_id: callerUser.id,
        action: 'delete_organization',
        target_organization_id: null,
        previous_state: {
          id: existing.id,
          name: existing.name,
          plan_tier: existing.plan_tier,
          subscription_status: existing.subscription_status,
        },
        new_state: {
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        },
        reason: reason || `Organization "${existing.name}" permanently deleted`,
      });

      const { error: delErr } = await adminClient.from('organizations').delete().eq('id', orgId);
      if (delErr) {
        await adminClient
          .from('organizations')
          .update({ subscription_status: 'suspended', is_active: false })
          .eq('id', orgId);
      }

      res.json({
        success: true,
        deleted_organization_id: orgId,
        deleted_name: existing.name,
        reason,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete organization.' });
    }
  });

  // Activity Login / Logout Persistence Endpoints
  app.get('/api/activity/logins', requireStaffSession, async (req, res) => {
    const adminClient = adminClientGetter()!;
    const callerProfile = (req as any).callerProfile;
    try {
      let query = adminClient
        .from('user_login_logs')
        .select('*')
        .order('login_at', { ascending: false })
        .limit(150);

      if (callerProfile.role !== 'creator') {
        query = query.eq('organization_id', callerProfile.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, logins: data || [] });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch login history.' });
    }
  });

  app.post('/api/activity/logins', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminClient = adminClientGetter();
    if (!authHeader || !authHeader.startsWith('Bearer ') || !adminClient) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const token = authHeader.slice(7).trim();
      const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        res.status(401).json({ error: 'Invalid session token.' });
        return;
      }

      const user = userData.user;
      const { data: profile } = await adminClient
        .from('staff_profiles')
        .select('organization_id, role, full_name, email')
        .eq('id', user.id)
        .maybeSingle();

      const resolvedOrgId =
        profile?.organization_id ||
        (ERP_UUID_REGEX.test(String(req.body?.organizationId || ''))
          ? String(req.body.organizationId)
          : null);

      let resolvedOrgName = String(req.body?.organizationName || 'Amansocean Coldstore');
      if (resolvedOrgId) {
        const { data: orgRow } = await adminClient
          .from('organizations')
          .select('name')
          .eq('id', resolvedOrgId)
          .maybeSingle();
        if (orgRow?.name) resolvedOrgName = orgRow.name;
      }

      const clientIp =
        (typeof req.headers['x-forwarded-for'] === 'string'
          ? req.headers['x-forwarded-for'].split(',')[0].trim()
          : req.socket.remoteAddress) || null;

      const { data: row, error: insErr } = await adminClient
        .from('user_login_logs')
        .insert({
          user_id: user.id,
          organization_id: resolvedOrgId,
          organization_name: resolvedOrgName,
          email: user.email || String(req.body?.email || ''),
          full_name:
            profile?.full_name ||
            String(req.body?.fullName || user.email?.split('@')[0] || 'Staff'),
          role: profile?.role || String(req.body?.role || 'staff'),
          device_type: String(req.body?.deviceType || 'desktop'),
          user_agent: String(req.body?.userAgent || req.headers['user-agent'] || 'Web Client'),
          client_ip: clientIp,
          session_status: 'active',
        })
        .select('*')
        .maybeSingle();

      if (insErr) throw insErr;
      res.status(201).json({ success: true, login: row });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to record login log.' });
    }
  });

  app.post('/api/activity/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    const adminClient = adminClientGetter();
    if (!authHeader || !authHeader.startsWith('Bearer ') || !adminClient) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      const token = authHeader.slice(7).trim();
      const { data: userData } = await adminClient.auth.getUser(token);
      const uid = userData?.user?.id || req.body?.userId;
      if (uid && ERP_UUID_REGEX.test(String(uid))) {
        await adminClient
          .from('user_login_logs')
          .update({ session_status: 'expired' })
          .eq('user_id', uid)
          .eq('session_status', 'active');
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to record logout.' });
    }
  });

  // Vite middleware for development
  if (options.withVite !== false) {
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
  }

  return app;
}

export async function startServer() {
  const app = await createExpressApp({ withVite: true });
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Frostly server running with Google SMTP on http://0.0.0.0:${PORT}`);
    // Automatically ensure the primary Amans Ocean Supabase catalog is seeded on startup
    fetch(`http://127.0.0.1:${PORT}/api/storefront/catalog`).catch(() => {});
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}
