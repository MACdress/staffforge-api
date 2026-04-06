// Payment routes

import { Database } from '../db/index.js';

// Pricing configuration
const PRICING = {
  pro_monthly: {
    name: 'Pro Monthly',
    price: 9.90,
    currency: 'USD',
    interval: 'month',
    description: 'Unlimited AI config generation with Pro features'
  },
  pro_yearly: {
    name: 'Pro Yearly',
    price: 79.00,
    currency: 'USD',
    interval: 'year',
    description: 'Unlimited AI config generation - Save 33%',
    savings: '33%'
  }
};

// Get PayPal access token
async function getPayPalAccessToken(env) {
  const isProduction = env.ENVIRONMENT === 'production';
  const apiUrl = isProduction ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
  
  const response = await fetch(`${apiUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`)}`
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error('Failed to get PayPal access token');
  }
  
  const data = await response.json();
  return data.access_token;
}

// Get PayPal plan ID
function getPayPalPlanId(plan, env) {
  const planIds = {
    pro_monthly: env.PAYPAL_PLAN_MONTHLY_ID,
    pro_yearly: env.PAYPAL_PLAN_YEARLY_ID
  };
  return planIds[plan];
}

// Get plans
export async function handleGetPlans(request, env) {
  return new Response(
    JSON.stringify({ success: true, data: PRICING }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

// Create subscription
export async function handleCreateSubscription(request, env, user) {
  try {
    const { plan } = await request.json();
    
    if (!PRICING[plan]) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const accessToken = await getPayPalAccessToken(env);
    const isProduction = env.ENVIRONMENT === 'production';
    const apiUrl = isProduction ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
    
    const response = await fetch(`${apiUrl}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        plan_id: getPayPalPlanId(plan, env),
        subscriber: {
          name: {
            given_name: user.name?.split(' ')[0] || 'User',
            surname: user.name?.split(' ')[1] || ''
          },
          email_address: user.email
        },
        application_context: {
          brand_name: 'StaffForge',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${env.FRONTEND_URL}/payment/success`,
          cancel_url: `${env.FRONTEND_URL}/payment/cancel`
        },
        custom_id: user.id
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`PayPal API error: ${error}`);
    }
    
    const subscription = await response.json();
    
    // Save pending subscription
    const db = new Database(env.DB);
    await db.updateSubscription(user.id, {
      plan: plan,
      status: 'pending',
      paypalSubscriptionId: subscription.id
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscriptionId: subscription.id,
          approvalUrl: subscription.links.find(link => link.rel === 'approve')?.href
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create subscription' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Confirm subscription
export async function handleConfirmSubscription(request, env, user) {
  try {
    const { subscriptionId } = await request.json();
    
    const accessToken = await getPayPalAccessToken(env);
    const isProduction = env.ENVIRONMENT === 'production';
    const apiUrl = isProduction ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
    
    const response = await fetch(`${apiUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get subscription details');
    }
    
    const subscription = await response.json();
    
    if (subscription.status === 'ACTIVE' || subscription.status === 'APPROVED') {
      const db = new Database(env.DB);
      
      // Update subscription
      await db.updateSubscription(user.id, {
        status: 'active',
        currentPeriodEnd: subscription.billing_info.next_billing_time
      });
      
      // Update user to Pro
      await db.updateUser(user.id, { isPro: true });
      
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            status: subscription.status,
            plan: subscription.plan_id,
            nextBillingTime: subscription.billing_info.next_billing_time
          }
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: `Subscription status is ${subscription.status}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Confirm subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to confirm subscription' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Cancel subscription
export async function handleCancelSubscription(request, env, user) {
  try {
    const db = new Database(env.DB);
    const subscription = await db.findSubscriptionByUserId(user.id);
    
    if (!subscription || !subscription.paypal_subscription_id) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const accessToken = await getPayPalAccessToken(env);
    const isProduction = env.ENVIRONMENT === 'production';
    const apiUrl = isProduction ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';
    
    // Cancel PayPal subscription
    const response = await fetch(
      `${apiUrl}/v1/billing/subscriptions/${subscription.paypal_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ reason: 'User requested cancellation' })
      }
    );
    
    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to cancel PayPal subscription');
    }
    
    // Update database
    await db.updateSubscription(user.id, { status: 'cancelled' });
    await db.updateUser(user.id, { isPro: false });
    
    return new Response(
      JSON.stringify({ success: true, message: 'Subscription cancelled successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to cancel subscription' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get subscription status
export async function handleGetSubscriptionStatus(request, env, user) {
  try {
    const db = new Database(env.DB);
    const subscription = await db.findSubscriptionByUserId(user.id);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          plan: subscription?.plan || 'free',
          status: subscription?.status || 'active',
          currentPeriodEnd: subscription?.current_period_end,
          isPro: user.isPro
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get subscription status error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get subscription status' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// PayPal webhook
export async function handlePayPalWebhook(request, env) {
  try {
    const body = await request.json();
    const { event_type, resource } = body;
    
    console.log('PayPal webhook received:', event_type);
    
    const db = new Database(env.DB);
    
    switch (event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await handleSubscriptionActivated(resource, db);
        break;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        await handleSubscriptionCancelled(resource, db);
        break;
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        await handleSubscriptionSuspended(resource, db);
        break;
      case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
        console.log('Payment failed for subscription:', resource.id);
        break;
      case 'BILLING.SUBSCRIPTION.RENEWED':
        await handleSubscriptionRenewed(resource, db);
        break;
      default:
        console.log('Unhandled webhook event:', event_type);
    }
    
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500 });
  }
}

// Webhook handlers
async function handleSubscriptionActivated(resource, db) {
  const userId = resource.custom_id;
  const subscriptionId = resource.id;
  
  await db.updateSubscription(userId, {
    status: 'active',
    paypalSubscriptionId: subscriptionId,
    currentPeriodEnd: resource.billing_info?.next_billing_time
  });
  
  await db.updateUser(userId, { isPro: true });
  console.log(`Subscription activated for user ${userId}`);
}

async function handleSubscriptionCancelled(resource, db) {
  const subscription = await db.findSubscriptionByPayPalId(resource.id);
  
  if (subscription) {
    await db.updateSubscription(subscription.user_id, { status: 'cancelled' });
    await db.updateUser(subscription.user_id, { isPro: false });
    console.log(`Subscription cancelled for user ${subscription.user_id}`);
  }
}

async function handleSubscriptionSuspended(resource, db) {
  const subscription = await db.findSubscriptionByPayPalId(resource.id);
  
  if (subscription) {
    await db.updateSubscription(subscription.user_id, { status: 'suspended' });
    await db.updateUser(subscription.user_id, { isPro: false });
    console.log(`Subscription suspended for user ${subscription.user_id}`);
  }
}

async function handleSubscriptionRenewed(resource, db) {
  const subscription = await db.findSubscriptionByPayPalId(resource.id);
  
  if (subscription) {
    await db.updateSubscription(subscription.user_id, {
      status: 'active',
      currentPeriodEnd: resource.billing_info?.next_billing_time
    });
    console.log(`Subscription renewed for user ${subscription.user_id}`);
  }
}
