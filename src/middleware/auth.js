// JWT Authentication middleware using jose
import { jwtVerify, SignJWT } from 'jose';
import { Database } from '../db/index.js';

const ACCESS_TOKEN_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

/**
 * Get JWT secret as Uint8Array
 */
function getSecret(env) {
  const secret = env.JWT_SECRET || 'your-super-secret-jwt-key';
  return new TextEncoder().encode(secret);
}

/**
 * Generate access token
 */
export async function generateAccessToken(user, env) {
  const secret = getSecret(env);
  const token = await new SignJWT({
    userId: user.id,
    email: user.email,
    name: user.name,
    isPro: user.is_pro === 1 || user.is_pro === true,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRES_IN)
    .sign(secret);
  
  return token;
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(user, env) {
  const secret = getSecret(env);
  const token = await new SignJWT({
    userId: user.id,
    type: 'refresh'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRES_IN)
    .sign(secret);
  
  return token;
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token, env) {
  try {
    const secret = getSecret(env);
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.type !== 'access') {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token, env) {
  try {
    const secret = getSecret(env);
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.type !== 'refresh') {
      return null;
    }
    
    return payload;
  } catch (error) {
    return null;
  }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: 'No token provided',
      status: 401
    };
  }
  
  const token = authHeader.substring(7);
  const decoded = await verifyAccessToken(token, env);
  
  if (!decoded) {
    return {
      error: 'Invalid token',
      status: 401
    };
  }
  
  // Get user from database
  const db = new Database(env.DB);
  const user = await db.findUserById(decoded.userId);
  
  if (!user) {
    return {
      error: 'User not found',
      status: 401
    };
  }
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      isPro: user.is_pro === 1 || user.is_pro === true,
      provider: user.provider,
      createdAt: user.created_at
    }
  };
}

/**
 * Optional authentication middleware
 */
export async function optionalAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null };
  }
  
  const token = authHeader.substring(7);
  const decoded = await verifyAccessToken(token, env);
  
  if (!decoded) {
    return { user: null };
  }
  
  // Get user from database
  const db = new Database(env.DB);
  const user = await db.findUserById(decoded.userId);
  
  if (!user) {
    return { user: null };
  }
  
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      isPro: user.is_pro === 1 || user.is_pro === true,
      provider: user.provider,
      createdAt: user.created_at
    }
  };
}

/**
 * Require Pro subscription middleware
 */
export function requirePro(user) {
  if (!user) {
    return {
      error: 'Authentication required',
      status: 401
    };
  }
  
  if (!user.isPro) {
    return {
      error: 'Pro subscription required',
      code: 'PRO_REQUIRED',
      status: 403
    };
  }
  
  return { success: true };
}
