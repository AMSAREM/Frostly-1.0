/**
 * Service for Google SMTP integration and configuration diagnostics.
 * Replaces external SaaS providers like Resend with direct Google Workspace / Gmail SMTP (smtp.gmail.com).
 */

export interface GoogleSmtpConfigStatus {
  configured: boolean;
  provider: string;
  host: string;
  ports: {
    ssl: number;
    tls: number;
  };
  user: string | null;
  fromEmail: string | null;
  fromName: string;
  supabaseInstructions: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    senderEmail: string;
    senderName: string;
  };
}

export interface GoogleSmtpTestResult {
  success: boolean;
  configured?: boolean;
  message: string;
  recipient?: string;
  messageId?: string;
  error?: string;
  setupGuide?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

/**
 * Checks server-side Google SMTP configuration status.
 */
export async function getGoogleSmtpConfig(): Promise<GoogleSmtpConfigStatus> {
  try {
    const res = await fetch('/api/smtp/config');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Could not query /api/smtp/config:', err);
  }

  // Fallback defaults
  return {
    configured: false,
    provider: 'google_smtp',
    host: 'smtp.gmail.com',
    ports: { ssl: 465, tls: 587 },
    user: null,
    fromEmail: null,
    fromName: 'Frostly Seafood Platform',
    supabaseInstructions: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'your-google-email@gmail.com',
      senderEmail: 'your-google-email@gmail.com',
      senderName: 'Frostly Seafood Platform',
    },
  };
}

/**
 * Sends a test email via Google SMTP to verify credentials and connectivity.
 */
export async function testGoogleSmtpConnection(toEmail: string): Promise<GoogleSmtpTestResult> {
  try {
    const res = await fetch('/api/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: 'Network error communicating with Google SMTP endpoint',
      error: err?.message || 'Failed to connect to /api/smtp/test',
    };
  }
}

/**
 * Triggers direct confirmation email delivery via Google SMTP if configured.
 */
export async function sendDirectGoogleSmtpConfirmation(params: {
  email: string;
  orgName: string;
  adminName: string;
  confirmationUrl?: string;
}): Promise<{ sentDirectly: boolean; message: string }> {
  try {
    const res = await fetch('/api/smtp/send-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Direct Google SMTP dispatch call failed, falling back to Supabase auth SMTP:', err);
  }

  return {
    sentDirectly: false,
    message: 'Using Supabase Auth Custom Google SMTP dispatch',
  };
}
