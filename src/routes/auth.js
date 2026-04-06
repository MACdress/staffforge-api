// Authentication routes

import { Database } from '../db/index.js';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../middleware/auth.js';

// Password hashing using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hashedPassword) {
  const hash = await hashPassword(password);
  return hash === hashedPassword;
}

// Email validation
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Google OAuth handlers
export async function handleGoogleAuth(request, env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const redirectUri = `${env.FRONTEND_URL}/api/auth/google/callback`;
  
  const scope = encodeURIComponent('profile email');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}&` +
    `redirect_uri=${redirectUri}&` +
    `response_type=code&` +
    `scope=${scope}&` +
    `prompt=select_account`;
  
  return Response.redirect(authUrl, 302);
}

export async function handleGoogleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return Response.redirect(`${env.FRONTEND_URL}/login?error=google_auth_failed`, 302);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.FRONTEND_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens');
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    
    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }
    
    const googleUser = await userResponse.json();
    
    // Find or create user
    const db = new Database(env.DB);
    let user = await db.findUserByEmail(googleUser.email);
    
    if (!user) {
      // Create new user
      user = await db.createUser({
        email: googleUser.email,
        name: googleUser.name || googleUser.email.split('@')[0],
        avatar: googleUser.picture || '',
        provider: 'google',
        providerId: googleUser.id,
        isPro: false
      });
      
      // Create subscription and usage stats
      await db.createSubscription({ userId: user.id, plan: 'free', status: 'active' });
      await db.createUsageStats({ userId: user.id, dailyCount: 0, totalCount: 0 });
    } else if (user.provider !== 'google') {
      // Update provider info
      user = await db.updateUser(user.id, {
        provider: 'google',
        providerId: googleUser.id,
        avatar: googleUser.picture || user.avatar
      });
    }
    
    // Generate tokens
    const accessToken = await generateAccessToken(user, env);
    const refreshToken = await generateRefreshToken(user, env);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: expiresAt.toISOString()
    });
    
    // Redirect to frontend with tokens
    return Response.redirect(
      `${env.FRONTEND_URL}/auth/callback?token=${accessToken}&refreshToken=${refreshToken}&provider=google`,
      302
    );
  } catch (error) {
    console.error('Google auth error:', error);
    return Response.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`, 302);
  }
}

// Email registration
export async function handleEmailRegister(request, env) {
  try {
    const { email, password, name } = await request.json();
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = new Database(env.DB);
    
    // Check if user exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User already exists' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user
    const user = await db.createUser({
      email,
      password: hashedPassword,
      name: name || email.split('@')[0],
      provider: 'email',
      isPro: false
    });
    
    // Create subscription and usage stats
    await db.createSubscription({ userId: user.id, plan: 'free', status: 'active' });
    await db.createUsageStats({ userId: user.id, dailyCount: 0, totalCount: 0 });
    
    // Generate tokens
    const accessToken = await generateAccessToken(user, env);
    const refreshToken = await generateRefreshToken(user, env);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: expiresAt.toISOString()
    });
    
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          isPro: user.is_pro === 1,
          provider: user.provider,
          createdAt: user.created_at
        },
        accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return new Response(
      JSON.stringify({ error: 'Registration failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Email login
export async function handleEmailLogin(request, env) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = new Database(env.DB);
    const user = await db.findUserByEmail(email);
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!user.password) {
      return new Response(
        JSON.stringify({ error: 'Please login with your OAuth provider' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!await verifyPassword(password, user.password)) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate tokens
    const accessToken = await generateAccessToken(user, env);
    const refreshToken = await generateRefreshToken(user, env);
    
    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: expiresAt.toISOString()
    });
    
    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          isPro: user.is_pro === 1,
          provider: user.provider,
          createdAt: user.created_at
        },
        accessToken,
        refreshToken,
        expiresIn: 24 * 60 * 60
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Login failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Token refresh
export async function handleTokenRefresh(request, env) {
  try {
    const { refreshToken } = await request.json();
    
    if (!refreshToken) {
      return new Response(
        JSON.stringify({ error: 'Refresh token is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = new Database(env.DB);
    
    // Verify refresh token
    const decoded = await verifyRefreshToken(refreshToken, env);
    if (!decoded) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired refresh token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Find stored token
    const storedToken = await db.findRefreshToken(refreshToken);
    if (!storedToken || storedToken.is_revoked === 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired refresh token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Revoke old token
    await db.revokeRefreshToken(refreshToken);
    
    // Get user
    const user = await db.findUserById(decoded.userId);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate new tokens
    const newAccessToken = await generateAccessToken(user, env);
    const newRefreshToken = await generateRefreshToken(user, env);
    
    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await db.createRefreshToken({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: expiresAt.toISOString()
    });
    
    return new Response(
      JSON.stringify({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 24 * 60 * 60
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(
      JSON.stringify({ error: 'Token refresh failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Verify token
export async function handleVerifyToken(request, env, user) {
  return new Response(
    JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        isPro: user.isPro,
        provider: user.provider,
        createdAt: user.createdAt
      }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Get current user
export async function handleGetMe(request, env, user) {
  return new Response(
    JSON.stringify({ user }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Logout
export async function handleLogout(request, env) {
  try {
    const { refreshToken } = await request.json();
    
    if (refreshToken) {
      const db = new Database(env.DB);
      await db.revokeRefreshToken(refreshToken);
    }
    
    return new Response(
      JSON.stringify({ message: 'Logged out successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({ error: 'Logout failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}