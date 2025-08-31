import { authMiddleware } from '@clerk/nextjs'

export default authMiddleware({
  publicRoutes: [
    '/',
    '/api/webhooks/(.*)',
    '/api/health',
    '/pricing',
    '/features',
    '/docs/(.*)',
    '/plugins',
    '/plugins/(.*)',
    '/about',
    '/privacy',
    '/terms',
    '/contact',
    '/sign-in(.*)',
    '/sign-up(.*)',
  ],
  apiRoutes: ['/api/(.*)'],
  ignoredRoutes: [
    '/api/webhooks/clerk',
    '/api/webhooks/stripe',
    '/api/health',
    '/_next/(.*)',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
  ],
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}