// D1 Database helper functions

/**
 * Generate a CUID-like unique ID
 */
export function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `c${timestamp}${random}`;
}

/**
 * Database helper class
 */
export class Database {
  constructor(db) {
    this.db = db;
  }

  /**
   * Execute a query with parameters
   */
  async query(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = await stmt.bind(...params).all();
    return result.results || [];
  }

  /**
   * Execute a single query returning first result
   */
  async queryOne(sql, params = []) {
    const results = await this.query(sql, params);
    return results[0] || null;
  }

  /**
   * Execute an insert/update/delete
   */
  async execute(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return await stmt.bind(...params).run();
  }

  // ==================== User Operations ====================

  async findUserByEmail(email) {
    return await this.queryOne(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
  }

  async findUserById(id) {
    return await this.queryOne(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
  }

  async createUser(data) {
    const id = generateId();
    const now = new Date().toISOString();
    await this.execute(
      `INSERT INTO users (id, email, name, avatar, provider, provider_id, password, is_pro, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.email, data.name || null, data.avatar || null, data.provider || 'email', 
       data.providerId || null, data.password || null, data.isPro ? 1 : 0, now, now]
    );
    return { id, ...data, created_at: now, updated_at: now };
  }

  async updateUser(id, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = [];
    
    if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name); }
    if (data.avatar !== undefined) { updates.push('avatar = ?'); params.push(data.avatar); }
    if (data.provider !== undefined) { updates.push('provider = ?'); params.push(data.provider); }
    if (data.providerId !== undefined) { updates.push('provider_id = ?'); params.push(data.providerId); }
    if (data.password !== undefined) { updates.push('password = ?'); params.push(data.password); }
    if (data.isPro !== undefined) { updates.push('is_pro = ?'); params.push(data.isPro ? 1 : 0); }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    await this.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return await this.findUserById(id);
  }

  // ==================== Subscription Operations ====================

  async findSubscriptionByUserId(userId) {
    return await this.queryOne(
      'SELECT * FROM subscriptions WHERE user_id = ?',
      [userId]
    );
  }

  async findSubscriptionByPayPalId(paypalId) {
    return await this.queryOne(
      'SELECT * FROM subscriptions WHERE paypal_subscription_id = ?',
      [paypalId]
    );
  }

  async createSubscription(data) {
    const id = generateId();
    const now = new Date().toISOString();
    await this.execute(
      `INSERT INTO subscriptions (id, user_id, plan, status, current_period_end, paypal_subscription_id, paypal_order_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.plan || 'free', data.status || 'active', 
       data.currentPeriodEnd || null, data.paypalSubscriptionId || null, 
       data.paypalOrderId || null, now, now]
    );
    return { id, ...data, created_at: now, updated_at: now };
  }

  async updateSubscription(userId, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = [];
    
    if (data.plan !== undefined) { updates.push('plan = ?'); params.push(data.plan); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.currentPeriodEnd !== undefined) { updates.push('current_period_end = ?'); params.push(data.currentPeriodEnd); }
    if (data.paypalSubscriptionId !== undefined) { updates.push('paypal_subscription_id = ?'); params.push(data.paypalSubscriptionId); }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(userId);

    await this.execute(
      `UPDATE subscriptions SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );
    return await this.findSubscriptionByUserId(userId);
  }

  // ==================== Usage Stats Operations ====================

  async findUsageStatsByUserId(userId) {
    return await this.queryOne(
      'SELECT * FROM usage_stats WHERE user_id = ?',
      [userId]
    );
  }

  async createUsageStats(data) {
    const id = generateId();
    const now = new Date().toISOString();
    await this.execute(
      `INSERT INTO usage_stats (id, user_id, daily_count, last_used_date, total_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.dailyCount || 0, data.lastUsedDate || now, 
       data.totalCount || 0, now, now]
    );
    return { id, ...data, created_at: now, updated_at: now };
  }

  async updateUsageStats(userId, data) {
    const now = new Date().toISOString();
    const updates = [];
    const params = [];
    
    if (data.dailyCount !== undefined) { updates.push('daily_count = ?'); params.push(data.dailyCount); }
    if (data.lastUsedDate !== undefined) { updates.push('last_used_date = ?'); params.push(data.lastUsedDate); }
    if (data.totalCount !== undefined) { updates.push('total_count = ?'); params.push(data.totalCount); }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(userId);

    await this.execute(
      `UPDATE usage_stats SET ${updates.join(', ')} WHERE user_id = ?`,
      params
    );
    return await this.findUsageStatsByUserId(userId);
  }

  // ==================== Config History Operations ====================

  async findConfigHistoryById(id, userId) {
    return await this.queryOne(
      'SELECT * FROM config_history WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  }

  async findConfigHistoryByUserId(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;
    
    const results = await this.query(
      'SELECT * FROM config_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    
    const countResult = await this.queryOne(
      'SELECT COUNT(*) as total FROM config_history WHERE user_id = ?',
      [userId]
    );
    
    return {
      data: results,
      pagination: {
        page,
        limit,
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / limit)
      }
    };
  }

  async createConfigHistory(data) {
    const id = generateId();
    const now = new Date().toISOString();
    const configData = typeof data.configData === 'string' 
      ? data.configData 
      : JSON.stringify(data.configData);
    
    await this.execute(
      `INSERT INTO config_history (id, user_id, role_id, role_name, config_data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.userId, data.roleId, data.roleName, configData, now, now]
    );
    return { id, ...data, config_data: configData, created_at: now, updated_at: now };
  }

  async deleteConfigHistory(id, userId) {
    await this.execute(
      'DELETE FROM config_history WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return { deleted: true };
  }

  // ==================== Refresh Token Operations ====================

  async findRefreshToken(token) {
    return await this.queryOne(
      'SELECT rt.*, u.email, u.name, u.avatar, u.is_pro, u.provider FROM refresh_tokens rt ' +
      'JOIN users u ON rt.user_id = u.id ' +
      'WHERE rt.token = ? AND rt.is_revoked = 0',
      [token]
    );
  }

  async createRefreshToken(data) {
    const id = generateId();
    const now = new Date().toISOString();
    await this.execute(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, is_revoked, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
      [id, data.userId, data.token, data.expiresAt, now]
    );
    return { id, ...data, is_revoked: 0, created_at: now };
  }

  async revokeRefreshToken(token) {
    await this.execute(
      'UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?',
      [token]
    );
    return { revoked: true };
  }

  async revokeAllUserTokens(userId) {
    await this.execute(
      'UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?',
      [userId]
    );
    return { revoked: true };
  }

  // ==================== Anonymous Usage Operations ====================

  async findAnonymousUsage(ip, fingerprint, date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return await this.queryOne(
      'SELECT * FROM anonymous_usage WHERE ip_address = ? AND fingerprint = ? AND date(usage_date) = date(?)',
      [ip, fingerprint, dateStr]
    );
  }

  async createAnonymousUsage(data) {
    const id = generateId();
    const now = new Date().toISOString();
    const usageDate = data.usageDate || now;
    await this.execute(
      `INSERT INTO anonymous_usage (id, ip_address, fingerprint, usage_date, daily_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, data.ipAddress, data.fingerprint, usageDate, data.dailyCount || 0, now, now]
    );
    return { id, ...data, created_at: now, updated_at: now };
  }

  async incrementAnonymousUsage(ip, fingerprint, date) {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    const existing = await this.findAnonymousUsage(ip, fingerprint, dateStr);
    
    if (existing) {
      await this.execute(
        'UPDATE anonymous_usage SET daily_count = daily_count + 1, updated_at = ? WHERE id = ?',
        [new Date().toISOString(), existing.id]
      );
      return await this.findAnonymousUsage(ip, fingerprint, dateStr);
    } else {
      return await this.createAnonymousUsage({
        ipAddress: ip,
        fingerprint: fingerprint,
        usageDate: dateStr,
        dailyCount: 1
      });
    }
  }
}

export default Database;
