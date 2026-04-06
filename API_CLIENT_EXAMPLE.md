# StaffForge Workers API 客户端示例

## 基础配置

```javascript
// api.js
const API_BASE_URL = 'https://staffforge-api.your-subdomain.workers.dev';

async function api(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  // Add auth token if available
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Add device fingerprint for anonymous tracking
  const fingerprint = localStorage.getItem('deviceFingerprint') || generateFingerprint();
  config.headers['X-Device-Fingerprint'] = fingerprint;
  
  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data;
}

function generateFingerprint() {
  const fp = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('deviceFingerprint', fp);
  return fp;
}
```

## API 调用示例

### 角色相关

```javascript
// 获取角色列表
const roles = await api('/api/roles');

// 获取热门角色
const featured = await api('/api/roles/featured');

// 搜索角色
const searchResults = await api('/api/roles/search?q=fitness');

// 获取单个角色
const role = await api('/api/roles/beauty-influencer');
```

### 生成配置

```javascript
// 生成角色配置
const config = await api('/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    type: 'content',
    description: 'I need help creating social media content',
    level: 'intermediate',
    style: 'professional',
    language: 'en'
  })
});
```

### 认证

```javascript
// 邮箱注册
const register = await api('/api/auth/email/register', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    name: 'John Doe'
  })
});

// 邮箱登录
const login = await api('/api/auth/email/login', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

// 存储 token
localStorage.setItem('accessToken', login.accessToken);
localStorage.setItem('refreshToken', login.refreshToken);

// 刷新 token
const refresh = await api('/api/auth/refresh', {
  method: 'POST',
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

// 登出
await api('/api/auth/logout', {
  method: 'POST',
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### 使用限制

```javascript
// 获取使用状态
const usage = await api('/api/usage/status');
console.log(`Remaining: ${usage.remaining}, Used: ${usage.used}`);

// 获取详细统计 (需登录)
const stats = await api('/api/usage/stats');
```

### 配置历史

```javascript
// 获取配置历史
const history = await api('/api/configs/history');

// 获取单条配置
const config = await api('/api/configs/history/config-id-123');

// 删除配置
await api('/api/configs/history/config-id-123', {
  method: 'DELETE'
});

// 生成并保存配置
const generated = await api('/api/configs/generate', {
  method: 'POST',
  body: JSON.stringify({
    roleId: 'beauty-influencer',
    customPrompt: 'Focus on Instagram content'
  })
});
```

### 支付

```javascript
// 获取订阅计划
const plans = await api('/api/payment/plans');

// 创建订阅
const subscription = await api('/api/payment/create-subscription', {
  method: 'POST',
  body: JSON.stringify({
    plan: 'pro_monthly'
  })
});

// 重定向到 PayPal
window.location.href = subscription.data.approvalUrl;

// 确认订阅 (PayPal 回调后)
const confirmed = await api('/api/payment/confirm-subscription', {
  method: 'POST',
  body: JSON.stringify({
    subscriptionId: 'PAYPAL_SUBSCRIPTION_ID'
  })
});

// 获取订阅状态
const status = await api('/api/payment/subscription-status');

// 取消订阅
await api('/api/payment/cancel-subscription', {
  method: 'POST'
});
```

## 错误处理

```javascript
async function handleApiCall() {
  try {
    const data = await api('/api/some-endpoint');
    return data;
  } catch (error) {
    if (error.message === 'Daily limit exceeded') {
      // 提示用户升级
      showUpgradeModal();
    } else if (error.message === 'Invalid token') {
      // 尝试刷新 token
      await refreshToken();
    } else {
      // 显示错误
      showError(error.message);
    }
  }
}
```

## Vue 3 Composition API 示例

```javascript
// composables/useApi.js
import { ref } from 'vue';

const API_BASE_URL = 'https://staffforge-api.your-subdomain.workers.dev';

export function useApi() {
  const loading = ref(false);
  const error = ref(null);
  
  async function request(endpoint, options = {}) {
    loading.value = true;
    error.value = null;
    
    try {
      const token = localStorage.getItem('accessToken');
      const fingerprint = localStorage.getItem('deviceFingerprint') || generateFingerprint();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          'X-Device-Fingerprint': fingerprint,
          ...options.headers,
        },
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      
      return data;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  return { request, loading, error };
}

// Usage in component
import { useApi } from './composables/useApi';

export default {
  setup() {
    const { request, loading, error } = useApi();
    const roles = ref([]);
    
    async function loadRoles() {
      const result = await request('/api/roles');
      roles.value = result.data;
    }
    
    return { roles, loading, error, loadRoles };
  }
};
```
