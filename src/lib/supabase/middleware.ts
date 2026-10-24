import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSafeNext } from '@/lib/utils/safe-redirect';

function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anonKey &&
      !url.includes('your-project-id') &&
      !anonKey.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
  );
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Fast-path exit for static, API, or public asset routes
  const isPublicRoute =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname.includes('.') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/robots.txt' ||
    pathname === '/privacy';

  if (isPublicRoute || !isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/mfa/challenge') ||
    pathname.startsWith('/mfa-challenge');

  const isStrictlyProtectedRoute =
    pathname.startsWith('/settings/security') ||
    pathname.startsWith('/settings/mfa') ||
    pathname.startsWith('/mfa-enroll') ||
    pathname.startsWith('/mfa/enroll');

  // 2. Fast-path for users with NO auth cookies
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some(
    (c) => c.name.startsWith('sb-') || c.name.includes('auth-token')
  );

  // Signed-in users skip the landing page and go straight to the app
  if (pathname === '/' && hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  if (!hasAuthCookie) {
    if (isStrictlyProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', getSafeNext(pathname));
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // 3. User has auth cookies -> Validate & Refresh Session
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check auth user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If session invalid and accessing strictly protected route -> redirect to /login
  if (!user && isStrictlyProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', getSafeNext(pathname));
    return NextResponse.redirect(url);
  }

  // Authenticated users: Check MFA assurance level (AAL2)
  if (user) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMFA =
      aalData && aalData.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel;

    // If MFA is required but not completed, enforce /mfa/challenge
    if (
      needsMFA &&
      pathname !== '/mfa/challenge' &&
      pathname !== '/mfa-challenge' &&
      !pathname.startsWith('/auth/callback') &&
      !pathname.startsWith('/api/auth/callback')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/mfa/challenge';
      url.searchParams.set('next', getSafeNext(pathname));
      return NextResponse.redirect(url);
    }

    // If user is already fully authenticated, redirect away from login/signup/mfa challenge
    if (
      !needsMFA &&
      isAuthRoute &&
      !pathname.startsWith('/auth/callback') &&
      !pathname.startsWith('/api/auth/callback')
    ) {
      const nextParam = request.nextUrl.searchParams.get('next');
      const url = request.nextUrl.clone();
      url.pathname = getSafeNext(nextParam, '/home');
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
