import {NextRequest,NextResponse} from 'next/server';
import {securityHeaders} from '@/lib/security-headers';
export function proxy(request:NextRequest){
  const nonce=Buffer.from(crypto.randomUUID()).toString('base64');
  const headers=new Headers(request.headers);
  const policy=securityHeaders(process.env.NODE_ENV==='development',nonce).find(h=>h.key==='Content-Security-Policy')!.value;
  headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',policy);
  const response=NextResponse.next({request:{headers}});response.headers.set('Content-Security-Policy',policy);return response;
}
export const config={matcher:['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|demo|walkthrough).*)']};
