import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { AppError } from '../errors';

const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Specific limiters
export const applyLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'apply',
  points: 5, // 5 applications
  duration: 60 * 60, // per hour
});

export const generalLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'general',
  points: 100, // 100 requests
  duration: 60, // per minute
});

export async function checkRateLimit(limiter: RateLimiterRedis, key: string) {
  try {
    await limiter.consume(key);
    return true;
  } catch (rejRes) {
    throw new AppError('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
  }
}
