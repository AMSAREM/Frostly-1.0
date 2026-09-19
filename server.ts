import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
      const existingUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
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

  // Activate / Set Password Endpoint for Email-Activated Users
  app.post('/api/auth/set-password-and-activate', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and new password are required.' });
      return;
    }
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin service is not configured.' });
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data: userList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let targetUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );

      if (!targetUser) {
        // If user does not exist in Auth, provision directly with confirmed email
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
        });
        if (createErr || !newUser?.user) {
          res.status(404).json({ error: createErr?.message || `No account found for ${cleanEmail}.` });
          return;
        }
        targetUser = newUser.user;
      } else {
        const { error: updateErr } = await adminClient.auth.admin.updateUserById(targetUser.id, {
          password: password,
          email_confirm: true,
        });

        if (updateErr) {
          throw updateErr;
        }
      }

      // Ensure staff profile is marked active and onboarding complete
      await adminClient
        .from('staff_profiles')
        .update({ is_active: true, needs_onboarding: false, updated_at: new Date().toISOString() })
        .eq('id', targetUser.id);

      res.json({ success: true, message: 'Password updated and account activated successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to set password.' });
    }
  });

  // Instant 1-Click Activation Endpoint with Auto-Provisioning
  app.post('/api/auth/instant-activate', async (req, res) => {
    const { email, password } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required for activation.' });
      return;
    }
    const adminClient = getSupabaseAdmin();
    if (!adminClient) {
      res.status(500).json({ error: 'Supabase admin service is not configured.' });
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data: userList } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let targetUser = userList?.users?.find(
        (u) => u.email?.toLowerCase() === cleanEmail
      );

      if (!targetUser) {
        // Auto-provision user account in Supabase Auth if not yet created
        const tempPassword = (password && typeof password === 'string' && password.length >= 6)
          ? password
          : `Frostly_${Math.random().toString(36).slice(2, 10)}!`;
        const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: tempPassword,
          email_confirm: true,
        });
        if (createErr || !newUser?.user) {
          res.status(404).json({ error: createErr?.message || `No user account found for ${cleanEmail}.` });
          return;
        }
        targetUser = newUser.user;
      }

      // Mark email confirmed in Supabase Auth (and optionally update password if provided)
      const updatePayload: { email_confirm: boolean; password?: string } = {
        email_confirm: true,
      };
      if (password && typeof password === 'string' && password.length >= 6) {
        updatePayload.password = password;
      }
      await adminClient.auth.admin.updateUserById(targetUser.id, updatePayload);

      // Check if user has an existing staff profile & organization
      const { data: existingProfile } = await adminClient
        .from('staff_profiles')
        .select('id, organization_id, is_active')
        .eq('id', targetUser.id)
        .maybeSingle();

      let activeOrgId = existingProfile?.organization_id;
      let activeOrgName = '';

      if (!activeOrgId) {
        // Check if there is an invite in invites table
        const { data: pendingInvite } = await adminClient
          .from('invites')
          .select('*')
          .ilike('email', cleanEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingInvite) {
          activeOrgId = pendingInvite.organization_id;
          const { data: orgData } = await adminClient
            .from('organizations')
            .select('name')
            .eq('id', activeOrgId)
            .maybeSingle();
          activeOrgName = orgData?.name || 'Frostly Seafood Operations';

          await adminClient
            .from('staff_profiles')
            .upsert({
              id: targetUser.id,
              organization_id: activeOrgId,
              email: cleanEmail,
              full_name: targetUser.user_metadata?.full_name || cleanEmail.split('@')[0],
              role: pendingInvite.role || 'ops_staff',
              department: targetUser.user_metadata?.department || 'Operations',
              is_active: true,
              needs_onboarding: false,
              updated_at: new Date().toISOString(),
            });

          // Mark invite used
          await adminClient
            .from('invites')
            .update({ used_at: new Date().toISOString() })
            .eq('id', pendingInvite.id);
        }
      }

      if (!activeOrgId) {
        // Auto-provision tenant organization from user metadata or fallback
        const orgName = 
          targetUser.user_metadata?.organization_name || 
          targetUser.user_metadata?.org_name || 
          `${cleanEmail.split('@')[0].toUpperCase()} Seafood Operations`;
        
        const fullName = 
          targetUser.user_metadata?.full_name || 
          targetUser.user_metadata?.name || 
          cleanEmail.split('@')[0];
        
        const department = targetUser.user_metadata?.department || 'Executive Operations';
        const currency = targetUser.user_metadata?.currency || 'GHS';

        const { data: newOrg } = await adminClient
          .from('organizations')
          .insert({
            name: orgName,
            billing_currency: currency,
            plan_tier: 'starter',
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
            max_staff_seats: 5,
          })
          .select('*')
          .maybeSingle();

        if (newOrg) {
          activeOrgId = newOrg.id;
          activeOrgName = newOrg.name;

          await adminClient
            .from('staff_profiles')
            .upsert({
              id: targetUser.id,
              organization_id: activeOrgId,
              email: cleanEmail,
              full_name: fullName,
              role: 'admin',
              department: department,
              is_active: true,
              needs_onboarding: false,
              updated_at: new Date().toISOString(),
            });
        }
      } else {
        // Mark staff_profile as active
        await adminClient
          .from('staff_profiles')
          .update({ is_active: true, needs_onboarding: false, updated_at: new Date().toISOString() })
          .eq('id', targetUser.id);

        const { data: orgData } = await adminClient
          .from('organizations')
          .select('name')
          .eq('id', activeOrgId)
          .maybeSingle();
        activeOrgName = orgData?.name || '';
      }

      // Generate a magiclink action link so the browser can exchange session or sign in immediately
      const { data: linkData } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: cleanEmail,
      });

      res.json({
        success: true,
        email: cleanEmail,
        organization_id: activeOrgId,
        organization_name: activeOrgName,
        actionLink: linkData?.properties?.action_link,
        hashedToken: linkData?.properties?.hashed_token,
        emailOtp: linkData?.properties?.email_otp,
        message: 'Account successfully confirmed and activated in Supabase.',
      });
    } catch (err: any) {
      console.error('[Instant Activate Error]:', err);
      res.status(500).json({ error: err?.message || 'Failed to activate account.' });
    }
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
      let targetUserId = userId;
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!targetUserId && cleanEmail) {
        const { data: userList } = await adminClient.auth.admin.listUsers();
        const found = userList?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
        if (found) targetUserId = found.id;
      }

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
            needs_onboarding: false,
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
            needs_onboarding: false,
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

  // ==========================================
  // TENANT WORKSPACE: WORKER MANAGEMENT ROUTES
  // ==========================================

  // 1. List Workers and Pending Invites for a Tenant Workspace
  app.get('/api/tenant/workers', async (req, res) => {
    const { organizationId } = req.query;
    if (!organizationId || typeof organizationId !== 'string') {
      res.status(400).json({ error: 'Organization ID parameter is required.' });
      return;
    }

    const adminClient = getSupabaseAdmin();
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
  app.post('/api/tenant/workers', async (req, res) => {
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

    const adminClient = getSupabaseAdmin();
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

      if (password && password.trim().length >= 6) {
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
  app.patch('/api/tenant/workers/:id', async (req, res) => {
    const { id } = req.params;
    const { organizationId, role, department, full_name, is_active } = req.body;

    if (!id || !organizationId) {
      res.status(400).json({ error: 'Worker ID and Organization ID are required.' });
      return;
    }

    const adminClient = getSupabaseAdmin();
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
  app.delete('/api/tenant/workers/:id', async (req, res) => {
    const { id } = req.params;
    const { organizationId, isInvite } = req.query;

    if (!id || !organizationId) {
      res.status(400).json({ error: 'Worker ID and Organization ID are required.' });
      return;
    }

    const adminClient = getSupabaseAdmin();
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
  app.post('/api/tenant/workers/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { password, email, organizationName } = req.body;

    if (!id || !password) {
      res.status(400).json({ error: 'Worker ID and New Password are required.' });
      return;
    }

    const adminClient = getSupabaseAdmin();
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
