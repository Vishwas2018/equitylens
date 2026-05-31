import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ ok: true, version: process.env['BUILD_SHA'] ?? 'dev' });
}
