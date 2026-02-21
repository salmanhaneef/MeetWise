import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  '/api/webhook/clerk(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // 🚨 Allow all API routes in development for testing
  if (process.env.NODE_ENV === 'development') {
    const url = req.url;
    if (req.url.includes('/api/') && !req.url.includes('/api/webhook/clerk')) {
      // Skip auth for all /api/ routes in dev (except webhook)
      return;
    }
  }

  // For production or non-API routes, enforce auth
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};