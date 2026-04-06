// Generate routes - AI role configuration generation

import { roles } from './roles.js';

// 10个预定义角色数据（用于匹配）
const PREDEFINED_ROLES = [
  {
    id: 'beauty-influencer',
    name: 'Beauty Influencer Assistant',
    keywords: ['beauty', 'makeup', 'cosmetic', 'influencer', 'content', 'social media', 'instagram', 'tiktok', 'caption', 'hashtag'],
    category: 'Content',
    icon: '💄',
    description: 'Generate trending content ideas, write catchy captions, recommend visual styles and hashtags'
  },
  {
    id: 'language-coach',
    name: 'Language Learning Coach',
    keywords: ['language', 'learn', 'english', 'chinese', 'spanish', 'french', 'grammar', 'vocabulary', 'conversation', 'fluency'],
    category: 'Education',
    icon: '🌍',
    description: 'Personalized study plans, conversation practice, and progress tracking for language fluency'
  },
  {
    id: 'sales-crm',
    name: 'Sales CRM Manager',
    keywords: ['sales', 'crm', 'lead', 'pipeline', 'customer', 'deal', 'conversion', 'revenue', 'business', 'client'],
    category: 'Business',
    icon: '📊',
    description: 'Track deals, nurture leads, and optimize your sales process for maximum conversion'
  },
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    keywords: ['code', 'review', 'programming', 'bug', 'debug', 'software', 'developer', 'coding', 'quality', 'maintainability'],
    category: 'Development',
    icon: '🔍',
    description: 'Catch bugs, enforce standards, and help write cleaner, more maintainable code'
  },
  {
    id: 'schedule-secretary',
    name: 'Schedule Secretary',
    keywords: ['schedule', 'calendar', 'meeting', 'time', 'appointment', 'planning', 'reminder', 'agenda', 'organize'],
    category: 'Productivity',
    icon: '📅',
    description: 'Manage your calendar, optimize your schedule, and ensure you never miss what matters'
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report Generator',
    keywords: ['report', 'weekly', 'summary', 'analytics', 'data', 'performance', 'metrics', 'stakeholder', 'insights'],
    category: 'Productivity',
    icon: '📈',
    description: 'Transform weekly activities into clear, actionable reports for stakeholders'
  },
  {
    id: 'fitness-coach',
    name: 'Fitness Coach',
    keywords: ['fitness', 'workout', 'exercise', 'gym', 'health', 'nutrition', 'training', 'muscle', 'diet', 'wellness'],
    category: 'Health',
    icon: '💪',
    description: 'Customized workout plans, nutrition guidance, and motivation for fitness goals'
  },
  {
    id: 'travel-planner',
    name: 'Travel Planner',
    keywords: ['travel', 'trip', 'vacation', 'itinerary', 'destination', 'hotel', 'flight', 'tour', 'adventure', 'explore'],
    category: 'Lifestyle',
    icon: '✈️',
    description: 'Craft personalized itineraries, find hidden gems, and ensure seamless travel experiences'
  },
  {
    id: 'investment-advisor',
    name: 'Investment Advisor',
    keywords: ['investment', 'finance', 'stock', 'portfolio', 'market', 'money', 'wealth', 'asset', 'trading', 'fund'],
    category: 'Finance',
    icon: '💰',
    description: 'Market analysis, portfolio guidance, and educational resources for informed decisions'
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep Coach',
    keywords: ['interview', 'job', 'career', 'hiring', 'resume', 'candidate', 'recruiter', 'employment', 'position'],
    category: 'Career',
    icon: '🎯',
    description: 'Prepare, practice, and perform your best in any interview situation'
  }
];

/**
 * Generate role configuration
 */
export async function generateRoleConfig(params) {
  const { type, description, skills, level, style, language } = params;
  
  if (!description) {
    throw new Error('Description is required');
  }
  
  // Match predefined role
  const matchedRole = findBestMatch(description, type);
  
  if (matchedRole && matchedRole.confidence > 0.5) {
    const roleConfig = await loadRoleConfig(matchedRole.role.id);
    return {
      ...roleConfig,
      matchConfidence: matchedRole.confidence,
      matchedFrom: matchedRole.role.id,
      isPredefined: true
    };
  }
  
  // Generate custom role
  const generatedRole = generateCustomRole({
    type,
    description,
    skills,
    level,
    style,
    language
  });
  
  return {
    ...generatedRole,
    isPredefined: false
  };
}

/**
 * Find best matching predefined role
 */
function findBestMatch(description, type) {
  const descLower = description.toLowerCase();
  const typeLower = (type || '').toLowerCase();
  
  let bestMatch = null;
  let bestScore = 0;
  let maxPossibleScore = 0;
  
  for (const role of PREDEFINED_ROLES) {
    let score = 0;
    let matchedKeywords = 0;
    
    // Keyword matching
    for (const keyword of role.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        score += 1;
        matchedKeywords++;
      }
    }
    
    // Type matching
    if (typeLower) {
      const roleCatLower = role.category.toLowerCase();
      if (roleCatLower.includes(typeLower) || typeLower.includes(roleCatLower)) {
        score += 3;
      }
    }
    
    const roleMaxScore = role.keywords.length + 3;
    const normalizedScore = score / roleMaxScore;
    
    if (normalizedScore > bestScore && matchedKeywords >= 2) {
      bestScore = normalizedScore;
      bestMatch = role;
      maxPossibleScore = roleMaxScore;
    }
  }
  
  return bestMatch ? { role: bestMatch, confidence: bestScore } : null;
}

/**
 * Load predefined role configuration
 */
async function loadRoleConfig(roleId) {
  const predefined = PREDEFINED_ROLES.find(r => r.id === roleId);
  const fullRole = roles.find(r => r.id === roleId);
  
  if (!predefined || !fullRole) {
    throw new Error(`Role not found: ${roleId}`);
  }
  
  // Generate configuration files content
  const soulContent = generateSoulContent(fullRole, '');
  const agentsContent = generateAgentsContent(fullRole);
  const toolsContent = generateToolsContent(fullRole);
  
  return {
    id: roleId,
    name: predefined.name,
    description: predefined.description,
    category: predefined.category,
    icon: predefined.icon,
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    config: {
      'SOUL.md': soulContent,
      'AGENTS.md': agentsContent,
      'TOOLS.md': toolsContent,
      'HEARTBEAT.md': generateHeartbeatContent(fullRole)
    },
    systemPrompt: soulContent,
    createdAt: new Date().toISOString()
  };
}

/**
 * Generate custom role
 */
function generateCustomRole(params) {
  const { type, description, skills, level, style, language } = params;
  
  const roleName = generateRoleName(type, description);
  const systemPrompt = generateSystemPrompt(params);
  const category = getCategoryName(type);
  
  return {
    id: 'custom-' + Date.now().toString(36),
    name: roleName,
    description: description,
    category: category,
    icon: getIconByCategory(category),
    level: getLevelName(level),
    style: getStyleName(style),
    language: language || 'zh',
    systemPrompt: systemPrompt,
    skills: skills ? skills.split(',').map(s => s.trim()) : [],
    examples: generateExamples(params),
    createdAt: new Date().toISOString()
  };
}

// Helper functions
function generateRoleName(type, description) {
  const typeNames = {
    tech: 'Technical',
    business: 'Business',
    creative: 'Creative',
    service: 'Service',
    education: 'Educational',
    health: 'Health',
    finance: 'Financial',
    lifestyle: 'Lifestyle',
    productivity: 'Productivity',
    career: 'Career',
    content: 'Content',
    development: 'Development'
  };
  
  const baseName = typeNames[type] || 'AI';
  const keywords = description.toLowerCase().split(/\s+/);
  const mainKeyword = keywords.find(w => w.length > 3) || 'Assistant';
  
  return `${mainKeyword.charAt(0).toUpperCase() + mainKeyword.slice(1)} ${baseName} Assistant`;
}

function generateSystemPrompt(params) {
  const { description, level, style } = params;
  
  const levelInstructions = {
    beginner: 'Explain in a way that beginners can understand, using simple and clear language',
    intermediate: 'Provide moderate technical details suitable for those with some foundation',
    advanced: 'Deep technical details with professional terminology for advanced users',
    expert: 'Expert-level depth covering cutting-edge technologies and best practices'
  };
  
  const styleInstructions = {
    professional: 'Maintain a professional and rigorous tone',
    friendly: 'Use a friendly and approachable tone',
    concise: 'Answer briefly and directly to the point',
    detailed: 'Provide detailed and comprehensive answers'
  };
  
  return `# Role Definition

You are ${description}.

## Professional Level
${levelInstructions[params.level] || levelInstructions.intermediate}

## Communication Style
${styleInstructions[style] || styleInstructions.professional}

## Response Principles
1. Provide accurate information based on your professional knowledge
2. Consider the user's actual needs and usage scenarios
3. Offer practical advice and best practices
4. Provide code examples or specific steps when necessary

## Guidelines
- Be helpful, accurate, and professional
- Ask clarifying questions when needed
- Admit when you don't know something
- Always prioritize user safety and privacy`;
}

function getCategoryName(type) {
  const categories = {
    tech: 'Development',
    business: 'Business',
    creative: 'Content',
    service: 'Service',
    education: 'Education',
    health: 'Health',
    finance: 'Finance',
    lifestyle: 'Lifestyle',
    productivity: 'Productivity',
    career: 'Career',
    content: 'Content',
    development: 'Development'
  };
  return categories[type] || 'General';
}

function getIconByCategory(category) {
  const icons = {
    Development: '💻',
    Business: '💼',
    Content: '🎨',
    Service: '🤝',
    Education: '📚',
    Health: '❤️',
    Finance: '💰',
    Lifestyle: '🌟',
    Productivity: '⚡',
    Career: '🚀',
    General: '🤖'
  };
  return icons[category] || '🤖';
}

function getLevelName(level) {
  const levels = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert'
  };
  return levels[level] || 'Intermediate';
}

function getStyleName(style) {
  const styles = {
    professional: 'Professional',
    friendly: 'Friendly',
    concise: 'Concise',
    detailed: 'Detailed'
  };
  return styles[style] || 'Professional';
}

function generateExamples(params) {
  return [
    {
      user: 'Can you introduce your professional capabilities?',
      assistant: `Certainly! I specialize in ${params.description} with the following core capabilities:

1. **Professional Knowledge** - Solid theoretical foundation and practical experience
2. **Problem Solving** - Quickly identify and resolve complex issues
3. **Best Practices** - Familiar with industry standards and best practices

Is there anything specific I can help you with?`
    },
    {
      user: 'I need some advice',
      assistant: "I'd be happy to provide advice. Please tell me more about your specific needs and background so I can give more targeted recommendations."
    }
  ];
}

function generateSoulContent(role, customPrompt = '') {
  return `# ${role.name}

## Personality
${role.systemPrompt || role.description}

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

## Communication Style
- ${role.style || 'professional'}
- Clear and concise
- Adaptive to user preferences

---
*Generated by StaffForge*`;
}

function generateToolsContent(role) {
  const toolsByCategory = {
    'Content': [
      { name: 'content-writer', desc: 'Generate engaging content and captions' },
      { name: 'copywriter', desc: 'Professional marketing copy' },
      { name: 'marketing-mode', desc: 'Marketing strategy assistance' }
    ],
    'Education': [
      { name: 'language-learning', desc: 'Personalized learning plans' },
      { name: 'translation', desc: 'Multi-language support' },
      { name: 'active-learner', desc: 'Interactive learning techniques' }
    ],
    'Business': [
      { name: 'excel-xlsx', desc: 'Spreadsheet management' },
      { name: 'document-pro', desc: 'Document creation and editing' },
      { name: 'meeting-notes', desc: 'Meeting transcription and summaries' }
    ],
    'Development': [
      { name: 'code-review', desc: 'Code quality analysis' },
      { name: 'document-pro', desc: 'Technical documentation' },
      { name: 'summarize', desc: 'Content summarization' }
    ],
    'Productivity': [
      { name: 'task-planner', desc: 'Task management and scheduling' },
      { name: 'meeting-notes', desc: 'Meeting management' },
      { name: 'reminder', desc: 'Reminder and notification system' }
    ],
    'Health': [
      { name: 'fitness', desc: 'Fitness guidance and tracking' },
      { name: 'workout-logger', desc: 'Workout session tracking' },
      { name: 'healthy-eating', desc: 'Nutrition advice and meal planning' }
    ],
    'Lifestyle': [
      { name: 'travel-manager', desc: 'Travel planning and management' },
      { name: 'weather', desc: 'Weather forecasts and alerts' },
      { name: 'web-browsing', desc: 'Online research assistance' }
    ],
    'Finance': [
      { name: 'stock-research-engine', desc: 'Stock market research' },
      { name: 'summarize', desc: 'Financial news summarization' },
      { name: 'document-pro', desc: 'Financial document management' }
    ],
    'Career': [
      { name: 'interview-simulator', desc: 'Practice interview sessions' },
      { name: 'career', desc: 'Career development guidance' },
      { name: 'resume-cv-builder', desc: 'Resume and CV creation' }
    ]
  };
  
  const tools = toolsByCategory[role.category] || [
    { name: 'content-writer', desc: 'Content creation' },
    { name: 'document-pro', desc: 'Document management' }
  ];
  
  return `# Recommended Tools for ${role.name}

## Core Tools
${tools.map((t, i) => `${i + 1}. **${t.name}**: ${t.desc}`).join('\n')}

## Tool Configuration
Each tool can be configured through environment variables or config files.
Refer to individual tool documentation for setup instructions.

## Security Notes
- Review tool permissions before use
- Some tools may require OAuth authorization
- Keep API keys secure and never share them

---
*Generated by StaffForge*`;
}

function generateHeartbeatContent(role) {
  return `# Heartbeat for ${role.name}

## Status Check
- Active: Yes
- Last Check: ${new Date().toISOString()}
- Status: Operational

## Health Metrics
- Response Time: Normal
- Error Rate: 0%
- Availability: 100%

---
*Generated by StaffForge*`;
}