import type { FastifyInstance } from 'fastify';
import type { Domain } from '../../domain.js';
import { migrateDates } from './service.js';
import { registerPlans } from './plans.js';
import { registerVenues } from './venues.js';
import { registerPreviews } from './previews.js';
import { registerReviews } from './reviews.js';

export function registerDates(app: FastifyInstance, domain: Domain) {
  migrateDates(domain);
  registerVenues(app, domain);
  registerPlans(app, domain);
  registerReviews(app, domain);
  registerPreviews(app, domain);
}
