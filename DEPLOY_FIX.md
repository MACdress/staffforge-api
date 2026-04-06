# StaffForge Workers 部署修复

## 问题
1. Workers 部署时 `workers_dev` 未启用，导致无法通过 workers.dev 访问
2. 尝试添加自定义路由时报错：`Creating routes directly on your subdomain 'anzai' is not allowed`

## 修复方案

已在 `wrangler.toml` 中添加：

```toml
# 启用 workers.dev 子域名
workers_dev = true
preview_urls = true

[env.production]
workers_dev = true
preview_urls = true
```

**注意**：移除了自定义 `[[routes]]` 配置，因为 Cloudflare 不允许在 workers.dev 子域名上创建自定义路由。

## 部署后地址

启用 `workers_dev` 后，Workers 会自动获得以下地址：

| 环境 | 地址 |
|------|------|
| 开发 | `https://staffforge-api.anzai.workers.dev` |
| Production | `https://staffforge-api-production.anzai.workers.dev` |

## 重新部署

```bash
cd ~/.openclaw/workspace/projects/staffforge/workers

# 部署 production 环境
wrangler deploy --env production
```

## 验证

```bash
# 测试 health endpoint
curl https://staffforge-api-production.anzai.workers.dev/api/health

# 预期响应
{"status":"ok","timestamp":"...","environment":"cloudflare-workers"}
```

## 配置变更

```diff
+ workers_dev = true
+ preview_urls = true

[env.production]
+ workers_dev = true
+ preview_urls = true
- [[env.production.routes]]
- pattern = "..."
```

---
*修复时间: 2026-04-05*
*执行者: 老高*
