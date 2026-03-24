export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

// Utility function for API routes
export function handleApiError(error: any, res: any) {
  console.error('API Error:', error);
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.errorCode
    });
  }
  
  // Don't expose internal errors (like Firestore details) unless it's specifically safe
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
