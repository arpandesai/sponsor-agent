import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, hashAdminPassword } from '@/lib/adminAuth';

export const config = { matcher: ['/admin/:path*'] };

export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/admin/login') {
    return NextResponse.next();
  }

  // Fail closed: no password configured means the panel stays locked,
  // not open — a missing env var should never accidentally expose it.
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  const expectedHash = await hashAdminPassword(password);
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (cookie === expectedHash) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/admin/login', request.url));
}
