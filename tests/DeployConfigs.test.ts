import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Deploy Configuration Suite', () => {
  const deployDir = path.resolve(__dirname, '..', 'deploy');
  const nginxConfPath = path.join(deployDir, 'nginx.conf');
  const caddyfilePath = path.join(deployDir, 'Caddyfile');

  describe('Nginx Configuration (deploy/nginx.conf)', () => {
    it('should exist on disk', () => {
      expect(fs.existsSync(nginxConfPath)).toBe(true);
    });

    it('should contain domain and upstream proxy configuration', () => {
      const content = fs.readFileSync(nginxConfPath, 'utf-8');
      expect(content).toContain('server_name fuheshka.qd.je;');
      expect(content).toContain('proxy_pass http://127.0.0.1:4200;');
    });

    it('should configure unbuffered SSE streaming on /api/events', () => {
      const content = fs.readFileSync(nginxConfPath, 'utf-8');
      expect(content).toContain('location /api/events');
      expect(content).toContain('proxy_buffering off;');
      expect(content).toContain('chunked_transfer_encoding off;');
      expect(content).toContain('proxy_cache off;');
      expect(content).toContain('proxy_read_timeout');
    });

    it('should include gzip compression directives', () => {
      const content = fs.readFileSync(nginxConfPath, 'utf-8');
      expect(content).toContain('gzip on;');
      expect(content).toContain('gzip_types');
      expect(content).toContain('gzip_proxied');
    });

    it('should include standard security headers', () => {
      const content = fs.readFileSync(nginxConfPath, 'utf-8');
      expect(content).toContain('X-Frame-Options');
      expect(content).toContain('X-Content-Type-Options');
      expect(content).toContain('X-XSS-Protection');
      expect(content).toContain('Referrer-Policy');
      expect(content).toContain('Strict-Transport-Security');
    });

    it('should have balanced braces and proper block structure', () => {
      const content = fs.readFileSync(nginxConfPath, 'utf-8');
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(openBraces).toBe(closeBraces);
    });
  });

  describe('Caddy Configuration (deploy/Caddyfile)', () => {
    it('should exist on disk', () => {
      expect(fs.existsSync(caddyfilePath)).toBe(true);
    });

    it('should configure target domain and reverse proxy', () => {
      const content = fs.readFileSync(caddyfilePath, 'utf-8');
      expect(content).toContain('fuheshka.qd.je');
      expect(content).toContain('reverse_proxy 127.0.0.1:4200');
    });

    it('should configure unbuffered SSE streaming with flush_interval -1', () => {
      const content = fs.readFileSync(caddyfilePath, 'utf-8');
      expect(content).toContain('/api/events');
      expect(content).toContain('flush_interval -1');
    });

    it('should include security headers and encoding', () => {
      const content = fs.readFileSync(caddyfilePath, 'utf-8');
      expect(content).toContain('encode gzip zstd');
      expect(content).toContain('X-Frame-Options');
      expect(content).toContain('X-Content-Type-Options');
      expect(content).toContain('Strict-Transport-Security');
    });

    it('should have balanced braces and proper block structure', () => {
      const content = fs.readFileSync(caddyfilePath, 'utf-8');
      const openBraces = (content.match(/\{/g) || []).length;
      const closeBraces = (content.match(/\}/g) || []).length;
      expect(openBraces).toBeGreaterThan(0);
      expect(openBraces).toBe(closeBraces);
    });
  });
});
