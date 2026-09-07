export const ADMIN_COOKIE_NAME = 'admin_auth';

// Web Crypto (not Node's `crypto` module) so this works identically in
// Edge middleware and Node.js API routes with no extra dependency.
export async function hashAdminPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
