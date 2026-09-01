export default async (_request, context) => context.next();

export const config = {
  path: [
    '/api/public-registration/*',
    '/api/public-checkin/*',
  ],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
