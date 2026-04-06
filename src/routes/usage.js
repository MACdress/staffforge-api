// Usage tracking routes

import { Database } from '../db/index.js';

// Daily limits
const LIMITS = {
  ANONYMOUS: 3,
  FREE: 10,
  PRO: Infinity
};

/**
 * Get client IP from request
 */
function getClientIP(request) {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

/**
 * Get device fingerprint from request
 */
function getFingerprint(request) {
  return request.headers.get('x-device-fingerprint') || 'unknown';
}

/**
 * Get today's date string
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check anonymous user limit
 */
export async function checkAnonymousLimit(db, ip, fingerprint) {
  const today = getTodayString();
  
  let usage = await db.findAnonymousUsage(ip, fingerprint, today);
  
  if (!usage) {
    usage = await db.createAnonymousUsage({
      ipAddress: ip,
      fingerprint: fingerprint,
      usageDate: today,
      dailyCount: 0
    });
  }
  
  const remaining = Math.max(0, LIMITS.ANONYMOUS - usage.daily_count);
  
  return {
    allowed: remaining > 0,
    remaining,
    total: LIMITS.ANONYMOUS,
    used: usage.daily_count
  };
}

/**
 * Check user limit
 */
export async function checkUserLimit(db, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let stats = await db.findUsageStatsByUserId(userId);
  
  if (!stats) {
    stats = await db.createUsageStats({
      userId,
      dailyCount: 0,
      lastUsedDate: today.toISOString(),
      totalCount: 0
    });
  }
  
  // Check if it's a new day
  const lastUsed = new Date(stats.last_used_date);
  lastUsed.setHours(0, 0, 0, 0);
  
  if (lastUsed < today) {
    // Reset daily count
    stats = await db.updateUsageStats(userId, {
      dailyCount: 0,
      lastUsedDate: today.toISOString()
    });
  }
  
  // Get subscription
  const subscription = await db.findSubscriptionByUserId(userId);
  const isPro = subscription?.plan?.startsWith('pro') && subscription?.status === 'active';
  const limit = isPro ? LIMITS.PRO : LIMITS.FREE;
  
  if (isPro) {
    return {
      allowed: true,
      remaining: Infinity,
      total: Infinity,
      used: stats.daily_count,
      isPro: true
    };
  }
  
  const remaining = Math.max(0, limit - stats.daily_count);
  
  return {
    allowed: remaining > 0,
    remaining,
    total: limit,
    used: stats.daily_count,
    isPro: false
  };
}

/**
 * Increment anonymous usage
 */
export async function incrementAnonymousUsage(db, ip, fingerprint) {
  const today = new Date();
  await db.incrementAnonymousUsage(ip, fingerprint, today);
}

/**
 * Increment user usage
 */
export async function incrementUserUsage(db, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const stats = await db.findUsageStatsByUserId(userId);
  
  if (!stats) {
    await db.createUsageStats({
      userId,
      dailyCount: 1,
      lastUsedDate: today.toISOString(),
      totalCount: 1
    });
  } else {
    const lastUsed = new Date(stats.last_used_date);
    lastUsed.setHours(0, 0, 0, 0);
    
    if (lastUsed < today) {
      // New day
      await db.updateUsageStats(userId, {
        dailyCount: 1,
        lastUsedDate: today.toISOString(),
        totalCount: (stats.total_count || 0) + 1
      });
    } else {
      // Same day
      await db.updateUsageStats(userId, {
        dailyCount: (stats.daily_count || 0) + 1,
        totalCount: (stats.total_count || 0) + 1
      });
    }
  }
}

// Get usage status
export async function handleGetUsageStatus(request, env, user) {
  try {
    const db = new Database(env.DB);
    
    if (user) {
      const status = await checkUserLimit(db, user.id);
      return new Response(
        JSON.stringify({
          ...status,
          userId: user.id,
          isAuthenticated: true
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const ip = getClientIP(request);
      const fingerprint = getFingerprint(request);
      const status = await checkAnonymousLimit(db, ip, fingerprint);
      return new Response(
        JSON.stringify({
          ...status,
          isAuthenticated: false
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Get usage status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get usage status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Check usage
export async function handleCheckUsage(request, env, user) {
  try {
    const db = new Database(env.DB);
    
    if (user) {
      const status = await checkUserLimit(db, user.id);
      return new Response(
        JSON.stringify(status),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      const ip = getClientIP(request);
      const fingerprint = getFingerprint(request);
      const status = await checkAnonymousLimit(db, ip, fingerprint);
      return new Response(
        JSON.stringify(status),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Check usage error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to check usage' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get usage stats (authenticated only)
export async function handleGetUsageStats(request, env, user) {
  try {
    const db = new Database(env.DB);
    
    const stats = await db.findUsageStatsByUserId(user.id);
    const subscription = await db.findSubscriptionByUserId(user.id);
    const todayStatus = await checkUserLimit(db, user.id);
    
    return new Response(
      JSON.stringify({
        dailyCount: stats?.daily_count || 0,
        totalCount: stats?.total_count || 0,
        lastUsedDate: stats?.last_used_date,
        plan: subscription?.plan || 'free',
        status: subscription?.status || 'active',
        ...todayStatus
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get usage stats error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get usage stats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
