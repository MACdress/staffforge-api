#!/usr/bin/env node

/**
 * Data migration script from PostgreSQL to D1
 * 
 * Usage:
 * 1. Export PostgreSQL data to JSON files
 * 2. Run this script to import into D1
 * 
 * Export commands:
 * - psql $DATABASE_URL -c "COPY (SELECT row_to_json(t) FROM users t) TO STDOUT;" > users.json
 * - psql $DATABASE_URL -c "COPY (SELECT row_to_json(t) FROM subscriptions t) TO STDOUT;" > subscriptions.json
 * - psql $DATABASE_URL -c "COPY (SELECT row_to_json(t) FROM usage_stats t) TO STDOUT;" > usage_stats.json
 * - psql $DATABASE_URL -c "COPY (SELECT row_to_json(t) FROM config_history t) TO STDOUT;" > config_history.json
 */

const fs = require('fs');
const path = require('path');

// Convert PostgreSQL row to D1 format
function convertUser(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    provider: row.provider,
    provider_id: row.provider_id || row.providerId,
    password: row.password,
    is_pro: row.is_pro || row.isPro ? 1 : 0,
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt
  };
}

function convertSubscription(row) {
  return {
    id: row.id,
    user_id: row.user_id || row.userId,
    plan: row.plan,
    status: row.status,
    current_period_end: row.current_period_end || row.currentPeriodEnd,
    paypal_subscription_id: row.paypal_subscription_id || row.paypalSubscriptionId,
    paypal_order_id: row.paypal_order_id || row.paypalOrderId,
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt
  };
}

function convertUsageStats(row) {
  return {
    id: row.id,
    user_id: row.user_id || row.userId,
    daily_count: row.daily_count || row.dailyCount || 0,
    last_used_date: row.last_used_date || row.lastUsedDate,
    total_count: row.total_count || row.totalCount || 0,
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt
  };
}

function convertConfigHistory(row) {
  return {
    id: row.id,
    user_id: row.user_id || row.userId,
    role_id: row.role_id || row.roleId,
    role_name: row.role_name || row.roleName,
    config_data: typeof row.config_data === 'object' 
      ? JSON.stringify(row.config_data) 
      : (row.config_data || row.configData),
    created_at: row.created_at || row.createdAt,
    updated_at: row.updated_at || row.updatedAt
  };
}

// Generate SQL insert statements
function generateInsertSQL(table, rows, converter) {
  if (rows.length === 0) return '';
  
  const converted = rows.map(converter);
  const columns = Object.keys(converted[0]);
  
  const values = converted.map(row => {
    return '(' + columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'number') return val;
      return `'${String(val).replace(/'/g, "''")}'`;
    }).join(', ') + ')';
  }).join(',\n');
  
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values};`;
}

// Main migration function
async function migrate() {
  const dataDir = process.argv[2] || './data';
  const outputDir = process.argv[3] || './sql';
  
  console.log('Starting migration...');
  console.log(`Data directory: ${dataDir}`);
  console.log(`Output directory: ${outputDir}`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Process users
  try {
    const usersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
    const usersSQL = generateInsertSQL('users', usersData, convertUser);
    fs.writeFileSync(path.join(outputDir, '01_users.sql'), usersSQL);
    console.log(`✓ Migrated ${usersData.length} users`);
  } catch (e) {
    console.log('✗ No users data found');
  }
  
  // Process subscriptions
  try {
    const subsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'subscriptions.json'), 'utf8'));
    const subsSQL = generateInsertSQL('subscriptions', subsData, convertSubscription);
    fs.writeFileSync(path.join(outputDir, '02_subscriptions.sql'), subsSQL);
    console.log(`✓ Migrated ${subsData.length} subscriptions`);
  } catch (e) {
    console.log('✗ No subscriptions data found');
  }
  
  // Process usage_stats
  try {
    const usageData = JSON.parse(fs.readFileSync(path.join(dataDir, 'usage_stats.json'), 'utf8'));
    const usageSQL = generateInsertSQL('usage_stats', usageData, convertUsageStats);
    fs.writeFileSync(path.join(outputDir, '03_usage_stats.sql'), usageSQL);
    console.log(`✓ Migrated ${usageData.length} usage stats`);
  } catch (e) {
    console.log('✗ No usage stats data found');
  }
  
  // Process config_history
  try {
    const configData = JSON.parse(fs.readFileSync(path.join(dataDir, 'config_history.json'), 'utf8'));
    // Split into chunks if too large
    const chunkSize = 100;
    for (let i = 0; i < configData.length; i += chunkSize) {
      const chunk = configData.slice(i, i + chunkSize);
      const configSQL = generateInsertSQL('config_history', chunk, convertConfigHistory);
      fs.writeFileSync(path.join(outputDir, `04_config_history_${Math.floor(i / chunkSize) + 1}.sql`), configSQL);
    }
    console.log(`✓ Migrated ${configData.length} config history records`);
  } catch (e) {
    console.log('✗ No config history data found');
  }
  
  console.log('\nMigration complete!');
  console.log(`SQL files generated in: ${outputDir}`);
  console.log('\nTo import into D1, run:');
  console.log(`  wrangler d1 execute staffforge-db --file=${outputDir}/01_users.sql`);
  console.log(`  wrangler d1 execute staffforge-db --file=${outputDir}/02_subscriptions.sql`);
  console.log(`  wrangler d1 execute staffforge-db --file=${outputDir}/03_usage_stats.sql`);
  console.log(`  wrangler d1 execute staffforge-db --file=${outputDir}/04_config_history_1.sql`);
}

migrate().catch(console.error);
