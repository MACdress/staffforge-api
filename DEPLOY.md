# StaffForge Workers 部署文档

## 项目结构

```
workers/
├── src/
│   ├── index.js          # Workers 入口
│   ├── router.js         # 路由定义 (itty-router)
│   ├── middleware/
│   │   ├── auth.js       # JWT 验证 (jose)
│   │   ├── cors.js       # CORS 处理
│   │   └── error.js      # 错误处理
│   ├── routes/
│   │   ├── auth.js       # 认证路由
│   │   ├── roles.js      # 角色路由
│   │   ├── configs.js    # 配置路由
│   │   ├── generate.js   # 生成路由
│   │   ├── usage.js      # 使用限制路由
│   │   └── payment.js    # 支付路由
│   └── db/
│       ├── index.js      # D1 数据库操作
│       └── schema.sql    # 数据库 schema
├── wrangler.toml         # Workers 配置
└── package.json          # 依赖配置
```

## 部署步骤

### 1. 安装依赖

```bash
cd workers
npm install
```

### 2. 配置 wrangler.toml

编辑 `wrangler.toml`，更新以下配置：

```toml
# 修改为你的 D1 数据库 ID
[[d1_databases]]
binding = "DB"
database_name = "staffforge-db"
database_id = "your-actual-database-id"

# 修改为你的前端 URL
[vars]
FRONTEND_URL = "https://staffforge.pages.dev"
JWT_SECRET = "your-secure-jwt-secret"
```

### 3. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create staffforge-db

# 记录返回的 database_id，更新到 wrangler.toml
```

### 4. 初始化数据库

```bash
# 执行 schema 创建表
wrangler d1 execute staffforge-db --file=src/db/schema.sql
```

### 5. 配置 Secrets

```bash
# Google OAuth
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET

# PayPal
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
wrangler secret put PAYPAL_WEBHOOK_ID

# 生产环境
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put PAYPAL_CLIENT_ID --env production
wrangler secret put PAYPAL_CLIENT_SECRET --env production
wrangler secret put PAYPAL_WEBHOOK_ID --env production
```

### 6. 本地开发

```bash
# 启动本地开发服务器
npm run dev

# 或
wrangler dev
```

### 7. 部署到生产

```bash
# 部署
npm run deploy

# 或
wrangler deploy

# 部署到生产环境
wrangler deploy --env production
```

## API 端点

### Health
- `GET /api/health` - 健康检查

### Roles
- `GET /api/roles` - 获取角色列表
- `GET /api/roles/featured` - 获取热门角色
- `GET /api/roles/categories` - 获取分类列表
- `GET /api/roles/search?q=keyword` - 搜索角色
- `GET /api/roles/:id` - 获取单个角色

### Generate
- `POST /api/generate` - 生成角色配置

### Auth
- `GET /api/auth/google` - Google OAuth 登录
- `GET /api/auth/google/callback` - Google OAuth 回调
- `POST /api/auth/email/register` - 邮箱注册
- `POST /api/auth/email/login` - 邮箱登录
- `POST /api/auth/refresh` - 刷新 Token
- `POST /api/auth/logout` - 登出
- `GET /api/auth/verify` - 验证 Token
- `GET /api/auth/me` - 获取当前用户

### Usage
- `GET /api/usage/status` - 获取使用状态
- `POST /api/usage/check` - 检查使用限制
- `GET /api/usage/stats` - 获取使用统计 (需登录)

### Configs
- `POST /api/configs` - 保存配置 (需登录)
- `GET /api/configs/history` - 获取配置历史 (需登录)
- `GET /api/configs/history/:id` - 获取配置详情 (需登录)
- `DELETE /api/configs/history/:id` - 删除配置 (需登录)
- `POST /api/configs/generate` - 生成并保存配置

### Payment
- `GET /api/payment/plans` - 获取订阅计划
- `POST /api/payment/create-subscription` - 创建订阅 (需登录)
- `POST /api/payment/confirm-subscription` - 确认订阅 (需登录)
- `POST /api/payment/cancel-subscription` - 取消订阅 (需登录)
- `GET /api/payment/subscription-status` - 获取订阅状态 (需登录)
- `POST /api/payment/webhook` - PayPal Webhook

## 注意事项

1. **D1 数据库**: SQLite 语法，部分 PostgreSQL 功能不支持
2. **JWT**: 使用 jose 库替代 jsonwebtoken
3. **文件系统**: 使用 D1 存储，无本地文件系统
4. **CORS**: 自动处理跨域请求
5. **环境变量**: 敏感信息使用 `wrangler secret put`

## 迁移对比

| 功能 | Express (Node) | Workers |
|------|----------------|---------|
| 数据库 | PostgreSQL + Prisma | D1 (SQLite) |
| JWT | jsonwebtoken | jose |
| 路由 | express.Router | itty-router |
| 密码哈希 | bcryptjs | Web Crypto API |
| Session | 有状态 | 无状态 JWT |

## 故障排查

### 数据库连接失败
```bash
# 检查数据库 ID 是否正确
wrangler d1 list

# 重新执行 schema
wrangler d1 execute staffforge-db --file=src/db/schema.sql
```

### JWT 验证失败
- 检查 JWT_SECRET 是否配置正确
- 确保前后端使用相同的 secret

### CORS 错误
- 检查 FRONTEND_URL 环境变量
- 确保前端请求包含正确的 headers
