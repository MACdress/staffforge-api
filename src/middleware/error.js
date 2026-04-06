// Error handling utilities

export class AppError extends Error {
  constructor(message, status = 500, code = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

export function errorResponse(message, status = 500, code = null) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code: code,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

export function successResponse(data, status = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString()
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

export function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// Global error handler
export function handleError(error) {
  console.error('Error:', error);
  
  if (error instanceof AppError) {
    return errorResponse(error.message, error.status, error.code);
  }
  
  if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    return errorResponse('Invalid JSON in request body', 400, 'INVALID_JSON');
  }
  
  return errorResponse(
    process.env.ENVIRONMENT === 'production' 
      ? 'Internal Server Error' 
      : error.message,
    500
  );
}
