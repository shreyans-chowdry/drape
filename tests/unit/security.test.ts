import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyOrderSignature, verifySubscriptionSignature, verifyWebhookSignature } from '@/lib/server/razorpay';
import { toCsv } from '@/lib/server/backup';
import { safeNext } from '@/components/auth';

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('hex');

describe('Razorpay signatures', () => {
  const secret = 'test_secret';
  it('accepts a valid order signature and rejects a tampered one', () => {
    expect(verifyOrderSignature('order_1', 'pay_1', sign('order_1|pay_1', secret), secret)).toBe(true);
    expect(verifyOrderSignature('order_1', 'pay_2', sign('order_1|pay_1', secret), secret)).toBe(false);
  });
  it('uses payment|subscription order for subscriptions', () => {
    expect(verifySubscriptionSignature('sub_1', 'pay_1', sign('pay_1|sub_1', secret), secret)).toBe(true);
    expect(verifySubscriptionSignature('sub_1', 'pay_1', sign('sub_1|pay_1', secret), secret)).toBe(false);
  });
  it('verifies webhooks over the raw body', () => {
    const body = '{"event":"subscription.activated"}';
    expect(verifyWebhookSignature(body, sign(body, 'wh'), 'wh')).toBe(true);
    expect(verifyWebhookSignature(body + ' ', sign(body, 'wh'), 'wh')).toBe(false);
    expect(verifyWebhookSignature(body, 'short', 'wh')).toBe(false);
  });
  it('refuses everything when no secret is configured', () => {
    expect(verifyWebhookSignature('x', sign('x', ''), '')).toBe(false);
  });
});

describe('CSV export', () => {
  it('neutralises spreadsheet formulas and escapes quotes', () => {
    const csv = toCsv([{ name: '=HYPERLINK("x")', brand: '+1', description: 'a "b", c' }]);
    const row = csv.split('\n')[1];
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
    expect(row).toContain(`'+1`);
    expect(row).toContain(`"a ""b"", c"`);
  });
});

describe('post-login redirect', () => {
  it('only allows same-site paths', () => {
    expect(safeNext('/app/stylist')).toBe('/app/stylist');
    expect(safeNext('//evil.com')).toBe('/app');
    expect(safeNext('https://evil.com')).toBe('/app');
    expect(safeNext('/\\evil.com')).toBe('/app');
    expect(safeNext(null)).toBe('/app');
  });
});
