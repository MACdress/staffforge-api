// Config history routes

import { Database } from '../db/index.js';
import { generateRoleConfig } from './generate.js';
import { checkAnonymousLimit, checkUserLimit, incrementAnonymousUsage, incrementUserUsage } from './usage.js';
import { roles } from './roles.js';

// Get client IP
function getClientIP(request) {
  return request.headers.get('x-forwarded-for') || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// Get device fingerprint
function getFingerprint(request) {
  return request.headers.get('x-device-fingerprint') || 'unknown';
}

// Save config to history
export async function handleSaveConfig(request, env, user) {
  try {
    const { roleId, roleName, configData } = await request.json();
    
    if (!roleId || !roleName || !configData) {
      return new Response(
        JSON.stringify({ error: 'roleId, roleName and configData are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    if (!configData.soulContent && !configData.agentsContent && !configData.toolsContent) {
      return new Response(
        JSON.stringify({ error: 'configData must contain at least one of: soulContent, agentsContent, toolsContent' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = new Database(env.DB);
    const configHistory = await db.createConfigHistory({
      userId: user.id,
      roleId,
      roleName,
      configData
    });
    
    return new Response(
      JSON.stringify({ success: true, data: configHistory }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Save config error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to save config' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get config history list
export async function handleGetConfigHistory(request, env, user) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = parseInt(url.searchParams.get('limit')) || 20;
    
    const db = new Database(env.DB);
    const result = await db.findConfigHistoryByUserId(user.id, { page, limit });
    
    // Parse JSON config_data
    result.data = result.data.map(item => {
      try {
        if (typeof item.config_data === 'string') {
          item.config_data = JSON.parse(item.config_data);
        }
      } catch (e) {
        // Keep as is if parsing fails
      }
      return item;
    });
    
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get config history error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get config history' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Get single config detail
export async function handleGetConfigDetail(request, env, user, id) {
  try {
    const db = new Database(env.DB);
    const config = await db.findConfigHistoryById(id, user.id);
    
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Config not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse JSON config_data
    try {
      if (typeof config.config_data === 'string') {
        config.config_data = JSON.parse(config.config_data);
      }
    } catch (e) {
      // Keep as is if parsing fails
    }
    
    return new Response(
      JSON.stringify({ success: true, data: config }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get config detail error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get config detail' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Delete config
export async function handleDeleteConfig(request, env, user, id) {
  try {
    const db = new Database(env.DB);
    
    // Verify config exists and belongs to user
    const config = await db.findConfigHistoryById(id, user.id);
    if (!config) {
      return new Response(
        JSON.stringify({ error: 'Config not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    await db.deleteConfigHistory(id, user.id);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Config deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Delete config error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete config' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Generate and save config
export async function handleGenerateAndSave(request, env, user) {
  try {
    const { roleId, customPrompt } = await request.json();
    
    if (!roleId) {
      return new Response(
        JSON.stringify({ error: 'roleId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const db = new Database(env.DB);
    
    // Check usage limit
    let usageStatus;
    if (user) {
      usageStatus = await checkUserLimit(db, user.id);
    } else {
      const ip = getClientIP(request);
      const fingerprint = getFingerprint(request);
      usageStatus = await checkAnonymousLimit(db, ip, fingerprint);
    }
    
    if (!usageStatus.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Daily limit exceeded',
          code: 'USAGE_LIMIT_EXCEEDED',
          usage: usageStatus,
          upgradeUrl: '/upgrade'
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Get role info
    const role = roles.find(r => r.id === roleId);
    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Role not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate config content
    const configData = {
      soulContent: generateSoulContent(role, customPrompt),
      agentsContent: generateAgentsContent(role),
      toolsContent: generateToolsContent(role)
    };
    
    // Increment usage
    if (user) {
      await incrementUserUsage(db, user.id);
    } else {
      const ip = getClientIP(request);
      const fingerprint = getFingerprint(request);
      await incrementAnonymousUsage(db, ip, fingerprint);
    }
    
    // Save to history if logged in
    let savedConfig = null;
    if (user) {
      savedConfig = await db.createConfigHistory({
        userId: user.id,
        roleId,
        roleName: role.name,
        configData
      });
    }
    
    // Get updated usage status
    let updatedStatus;
    if (user) {
      updatedStatus = await checkUserLimit(db, user.id);
    } else {
      const ip = getClientIP(request);
      const fingerprint = getFingerprint(request);
      updatedStatus = await checkAnonymousLimit(db, ip, fingerprint);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          config: configData,
          savedRecord: savedConfig,
          role: {
            id: role.id,
            name: role.name,
            category: role.category,
            icon: role.icon
          }
        },
        usage: updatedStatus
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate config error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate config' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Helper functions for content generation
function generateSoulContent(role, customPrompt = '') {
  return `# ${role.name}

## Personality
${role.description}

${customPrompt ? `## Custom Requirements\n${customPrompt}\n` : ''}
## Capabilities
- Professional ${role.category.toLowerCase()} assistance
- Adaptive communication style: ${role.style || 'professional'}
- Language: ${role.language || 'zh'}
- Difficulty level: ${role.level || 'intermediate'}

---
*Generated by StaffForge*`;
}

function generateAgentsContent(role) {
  const skillsByCategory = {
    'Content': ['content-writer', 'copywriter', 'marketing-mode'],
    'Education': ['language-learning', 'active-learner', 'translation'],
    'Business': ['excel-xlsx', 'document-pro', 'meeting-notes'],
    'Development': ['code-review', 'document-pro', 'summarize'],
    'Productivity': ['task-planner', 'meeting-notes', 'reminder'],
    'Health': ['fitness', 'workout-logger', 'healthy-eating'],
    'Lifestyle': ['travel-manager', 'weather', 'web-browsing'],
    'Finance': ['stock-research-engine', 'summarize'],
    'Career': ['interview-simulator', 'career', 'resume-cv-builder']
  };
  
  const skills = skillsByCategory[role.category] || ['content-writer', 'document-pro'];
  
  return `# Collaboration Network for ${role.name}

## Primary Skills
${skills.map(s => `- ${s}`).join('\n')}

## Collaboration Mode
- Works independently on assigned tasks
- Reports progress regularly
- Escalates complex issues appropriately

---
*Generated by StaffForge*`;
}

function generateToolsContent(role) {
  const toolsByCategory = {
    'Content': [
      { name: 'content-writer', desc: 'Generate engaging content' },
      { name: 'copywriter', desc: 'Professional marketing copy' },
      { name: 'marketing-mode', desc: 'Marketing strategy assistance' }
    ],
    'Education': [
      { name: 'language-learning', desc: 'Personalized learning plans' },
      { name: 'translation', desc: 'Multi-language support' },
      { name: 'active-learner', desc: 'Interactive learning' }
    ],
    'Business': [
      { name: 'excel-xlsx', desc: 'Spreadsheet management' },
      { name: 'document-pro', desc: 'Document creation' },
      { name: 'meeting-notes', desc: 'Meeting summaries' }
    ],
    'Development': [
      { name: 'code-review', desc: 'Code quality analysis' },
      { name: 'document-pro', desc: 'Technical documentation' },
      { name: 'summarize', desc: 'Content summarization' }
    ],
    'Productivity': [
      { name: 'task-planner', desc: 'Task management' },
      { name: 'meeting-notes', desc: 'Meeting management' },
      { name: 'reminder', desc: 'Reminder system' }
    ],
    'Health': [
      { name: 'fitness', desc: 'Fitness guidance' },
      { name: 'workout-logger', desc: 'Workout tracking' },
      { name: 'healthy-eating', desc: 'Nutrition advice' }
    ],
    'Lifestyle': [
      { name: 'travel-manager', desc: 'Travel planning' },
      { name: 'weather', desc: 'Weather forecasts' },
      { name: 'web-browsing', desc: 'Online research' }
    ],
    'Finance': [
      { name: 'stock-research-engine', desc: 'Stock research' },
      { name: 'summarize', desc: 'Financial news' },
      { name: 'document-pro', desc: 'Document management' }
    ],
    'Career': [
      { name: 'interview-simulator', desc: 'Practice interviews' },
      { name: 'career', desc: 'Career guidance' },
      { name: 'resume-cv-builder', desc: 'Resume creation' }
    ]
  };
  
  const tools = toolsByCategory[role.category] || [
    { name: 'content-writer', desc: 'Content creation' },
    { name: 'document-pro', desc: 'Document management' }
  ];
  
  return `# Recommended Tools for ${role.name}

## Core Tools
${tools.map((t, i) => `${i + 1}. **${t.name}**: ${t.desc}`).join('\n')}

---
*Generated by StaffForge*`;
}
