// StaffForge API - Cloudflare Workers Entry Point

import { router } from './router.js';
import { handleCORS, addCORSHeaders } from './middleware/cors.js';
import { handleError } from './middleware/error.js';

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    const corsResponse = handleCORS(request, env);
    if (corsResponse) {
      return corsResponse;
    }
    
    try {
      // Route the request
      const response = await router.handle(request, env, ctx);
      
      // Add CORS headers to response
      return addCORSHeaders(response, env);
    } catch (error) {
      console.error('Request error:', error);
      const errorResponse = handleError(error);
      return addCORSHeaders(errorResponse, env);
    }
  }
};
