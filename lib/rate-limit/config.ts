import { RateLimiterRedis } from 'rate-limiter-flexible'
import Redis from 'ioredis'

const redisClient = new Redis(process.env.REDIS_URL!)

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'middleware',
  points: 10, // 10 requests
  duration: 1, // per 1 second by IP
})

export const rateLimit = async (req: any, res: any, next: any) => {
  try {
    await rateLimiter.consume(req.ip)
    next()
  } catch {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Please try again later.'
    })
  }
}

// Specific limiters for different endpoints
export const authLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'auth',
  points: 5, // 5 attempts
  duration: 60 * 15, // per 15 minutes
})

export const jobPostLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'job_post',
  points: 3, // 3 job posts
  duration: 60 * 60, // per hour
})
