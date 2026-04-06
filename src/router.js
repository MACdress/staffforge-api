// Router configuration using itty-router

import { Router } from 'itty-router';
import { handleCORS, addCORSHeaders } from './middleware/cors.js';
import { requireAuth, optionalAuth } from './middleware/auth.js';
import { handleError } from './middleware/error.js';

// Route handlers
import { 
  getRoles, 
  getFeaturedRoles, 
  getCategories, 
  searchRoles, 
  getRoleById 
} from './routes/roles.js';
import { generateRoleConfig } from './routes/generate.js';
import {
  handleGoogleAuth,
  handleGoogleCallback,
  handleEmailRegister,
  handleEmailLogin,
  handleTokenRefresh,
  handleVerifyToken,
  handleGetMe,
  handleLogout
} from './routes/auth.js';
import {
  handleGetUsageStatus,
  handleCheckUsage,
  handleGetUsageStats
} from './routes/usage.js';
import {
  handleSaveConfig,
  handleGetConfigHistory,
  handleGetConfigDetail,
  handleDeleteConfig,
  handleGenerateAndSave
} from './routes/configs.js';
import {
  handleGetPlans,
  handleCreateSubscription,
  handleConfirmSubscription,
  handleCancelSubscription,
  handleGetSubscriptionStatus,
  handlePayPalWebhook
} from './routes/payment.js';

// Create router
const router = Router();

// ==================== Health Check ====================
router.get('/api/health', () => {
  return new Response(
    JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      environment: 'cloudflare-workers'
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

// ==================== Roles Routes ====================
router.get('/api/roles', (request) => {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams);
  const result = getRoles(query);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/api/roles/featured', () => {
  const result = getFeaturedRoles();
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/api/roles/categories', () => {
  const result = getCategories();
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/api/roles/search', (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const result = searchRoles(q);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

router.get('/api/roles/:id', (request) => {
  const result = getRoleById(request.params.id);
  if (!result) {
    return new Response(
      JSON.stringify({ error: 'Role not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// ==================== Generate Routes ====================
router.post('/api/generate', async (request, env) => {
  try {
    const body = await request.json();
    const result = await generateRoleConfig(body);
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return handleError(error);
  }
});

// ==================== Auth Routes ====================
router.get('/api/auth/google', (request, env) => handleGoogleAuth(request, env));
router.get('/api/auth/google/callback', (request, env) => handleGoogleCallback(request, env));
router.post('/api/auth/email/register', (request, env) => handleEmailRegister(request, env));
router.post('/api/auth/email/login', (request, env) => handleEmailLogin(request, env));
router.post('/api/auth/refresh', (request, env) => handleTokenRefresh(request, env));
router.post('/api/auth/logout', (request, env) => handleLogout(request, env));

router.get('/api/auth/verify', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleVerifyToken(request, env, authResult.user);
});

router.get('/api/auth/me', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleGetMe(request, env, authResult.user);
});

// ==================== Usage Routes ====================
router.get('/api/usage/status', async (request, env) => {
  const authResult = await optionalAuth(request, env);
  return handleGetUsageStatus(request, env, authResult.user);
});

router.post('/api/usage/check', async (request, env) => {
  const authResult = await optionalAuth(request, env);
  return handleCheckUsage(request, env, authResult.user);
});

router.get('/api/usage/stats', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleGetUsageStats(request, env, authResult.user);
});

// ==================== Config Routes ====================
router.post('/api/configs', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleSaveConfig(request, env, authResult.user);
});

router.get('/api/configs/history', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleGetConfigHistory(request, env, authResult.user);
});

router.get('/api/configs/history/:id', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleGetConfigDetail(request, env, authResult.user, request.params.id);
});

router.delete('/api/configs/history/:id', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleDeleteConfig(request, env, authResult.user, request.params.id);
});

router.post('/api/configs/generate', async (request, env) => {
  const authResult = await optionalAuth(request, env);
  return handleGenerateAndSave(request, env, authResult.user);
});

// ==================== Payment Routes ====================
router.get('/api/payment/plans', (request, env) => handleGetPlans(request, env));

router.post('/api/payment/create-subscription', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleCreateSubscription(request, env, authResult.user);
});

router.post('/api/payment/confirm-subscription', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleConfirmSubscription(request, env, authResult.user);
});

router.post('/api/payment/cancel-subscription', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleCancelSubscription(request, env, authResult.user);
});

router.get('/api/payment/subscription-status', async (request, env) => {
  const authResult = await requireAuth(request, env);
  if (authResult.error) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return handleGetSubscriptionStatus(request, env, authResult.user);
});

router.post('/api/payment/webhook', (request, env) => handlePayPalWebhook(request, env));

// 404 handler
router.all('*', () => {
  return new Response(
    JSON.stringify({ error: 'Not Found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
});

export { router };
