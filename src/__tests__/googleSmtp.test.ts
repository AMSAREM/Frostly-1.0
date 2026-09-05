import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getGoogleSmtpConfig, 
  testGoogleSmtpConnection, 
  sendDirectGoogleSmtpConfirmation 
} from '../services/googleSmtpService';

describe('Google SMTP Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('provides standard Google SMTP host and port parameters in fallback config', async () => {
    // Mock fetch returning network failure to test fallback defaults
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unavailable')));

    const config = await getGoogleSmtpConfig();
    expect(config.host).toBe('smtp.gmail.com');
    expect(config.ports.ssl).toBe(465);
    expect(config.ports.tls).toBe(587);
    expect(config.supabaseInstructions.host).toBe('smtp.gmail.com');
    expect(config.supabaseInstructions.port).toBe(465);
    expect(config.supabaseInstructions.secure).toBe(true);
  });

  it('queries /api/smtp/config when available', async () => {
    const mockResponse = {
      configured: true,
      provider: 'google_smtp',
      host: 'smtp.gmail.com',
      ports: { ssl: 465, tls: 587 },
      user: 'ad***@gmail.com',
      fromEmail: 'ad***@gmail.com',
      fromName: 'Frostly Seafood Platform',
      supabaseInstructions: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'admin@gmail.com',
        senderEmail: 'admin@gmail.com',
        senderName: 'Frostly Seafood Platform',
      },
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    }));

    const config = await getGoogleSmtpConfig();
    expect(config.configured).toBe(true);
    expect(config.host).toBe('smtp.gmail.com');
    expect(config.user).toBe('ad***@gmail.com');
  });

  it('handles Google SMTP connection testing response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        configured: true,
        message: 'Test email successfully dispatched via Google SMTP (smtp.gmail.com:465).',
        recipient: 'test@example.com',
      }),
    }));

    const result = await testGoogleSmtpConnection('test@example.com');
    expect(result.success).toBe(true);
    expect(result.recipient).toBe('test@example.com');
    expect(result.message).toContain('Google SMTP');
  });

  it('dispatches direct confirmation email payload correctly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sentDirectly: true,
        message: 'Confirmation email dispatched directly through Google SMTP (smtp.gmail.com:465).',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendDirectGoogleSmtpConfirmation({
      email: 'admin@seafoodcoldchain.com',
      orgName: 'Pacific Frozen Wholesales',
      adminName: 'Hiroshi Tanaka',
      confirmationUrl: 'https://frostly.io/verify?token=abc',
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/smtp/send-confirmation', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'admin@seafoodcoldchain.com',
        orgName: 'Pacific Frozen Wholesales',
        adminName: 'Hiroshi Tanaka',
        confirmationUrl: 'https://frostly.io/verify?token=abc',
      }),
    }));
    expect(result.sentDirectly).toBe(true);
  });
});
