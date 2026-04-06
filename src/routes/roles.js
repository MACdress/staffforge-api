// Roles routes - static data (no DB required)

// 10个预定义角色数据
const roles = [
  {
    id: 'beauty-influencer',
    name: 'Beauty Influencer Assistant',
    description: 'Generate trending content ideas, write catchy captions, recommend visual styles and hashtags',
    category: 'Content',
    difficulty: 'Medium',
    icon: '💄',
    abilities: ['Content Generation', 'Caption Writing', 'Hashtag Research', 'Performance Analysis'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['web_fetch', 'image_gen', 'qqbot-cron'],
    popularity: 98
  },
  {
    id: 'language-coach',
    name: 'Language Learning Coach',
    description: 'Personalized study plans, conversation practice, and progress tracking for language fluency',
    category: 'Education',
    difficulty: 'Medium',
    icon: '🌍',
    abilities: ['Study Planning', 'Conversation Practice', 'Grammar Explanation', 'Progress Tracking'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-calendar', 'tts', 'feishu-task'],
    popularity: 92
  },
  {
    id: 'sales-crm',
    name: 'Sales CRM Manager',
    description: 'Track deals, nurture leads, and optimize your sales process for maximum conversion',
    category: 'Business',
    difficulty: 'Medium',
    icon: '📊',
    abilities: ['Pipeline Management', 'Lead Nurturing', 'Sales Analytics', 'Relationship Management'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-bitable', 'feishu-calendar', 'feishu-task'],
    popularity: 88
  },
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    description: 'Catch bugs, enforce standards, and help write cleaner, more maintainable code',
    category: 'Development',
    difficulty: 'Hard',
    icon: '🔍',
    abilities: ['Code Analysis', 'Style Enforcement', 'Architecture Review', 'Educational Feedback'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-create-doc', 'feishu-update-doc', 'feishu-fetch-doc'],
    popularity: 95
  },
  {
    id: 'schedule-secretary',
    name: 'Schedule Secretary',
    description: 'Manage your calendar, optimize your schedule, and ensure you never miss what matters',
    category: 'Productivity',
    difficulty: 'Easy',
    icon: '📅',
    abilities: ['Calendar Management', 'Meeting Optimization', 'Time Blocking', 'Travel Coordination'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-calendar', 'feishu-task', 'feishu-chat'],
    popularity: 90
  },
  {
    id: 'weekly-report',
    name: 'Weekly Report Generator',
    description: 'Transform weekly activities into clear, actionable reports for stakeholders',
    category: 'Productivity',
    difficulty: 'Easy',
    icon: '📈',
    abilities: ['Data Aggregation', 'Insight Generation', 'Report Creation', 'Stakeholder Communication'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-create-doc', 'feishu-sheet', 'feishu-bitable'],
    popularity: 85
  },
  {
    id: 'fitness-coach',
    name: 'Fitness Coach',
    description: 'Customized workout plans, nutrition guidance, and motivation for fitness goals',
    category: 'Health',
    difficulty: 'Medium',
    icon: '💪',
    abilities: ['Workout Planning', 'Nutrition Guidance', 'Progress Tracking', 'Motivation Support'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-task', 'feishu-calendar', 'feishu-bitable'],
    popularity: 93
  },
  {
    id: 'travel-planner',
    name: 'Travel Planner',
    description: 'Craft personalized itineraries, find hidden gems, and ensure seamless travel experiences',
    category: 'Lifestyle',
    difficulty: 'Medium',
    icon: '✈️',
    abilities: ['Itinerary Creation', 'Research & Discovery', 'Logistics Coordination', 'Travel Support'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['web_fetch', 'feishu-create-doc', 'feishu-task'],
    popularity: 87
  },
  {
    id: 'investment-advisor',
    name: 'Investment Advisor',
    description: 'Market analysis, portfolio guidance, and educational resources for informed decisions',
    category: 'Finance',
    difficulty: 'Hard',
    icon: '💰',
    abilities: ['Market Analysis', 'Portfolio Guidance', 'Educational Support', 'Research & Monitoring'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['web_fetch', 'feishu-bitable', 'feishu-sheet'],
    popularity: 82
  },
  {
    id: 'interview-prep',
    name: 'Interview Prep Coach',
    description: 'Prepare, practice, and perform your best in any interview situation',
    category: 'Career',
    difficulty: 'Medium',
    icon: '🎯',
    abilities: ['Interview Strategy', 'Question Preparation', 'Mock Interviews', 'Confidence Building'],
    files: ['SOUL.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'],
    recommendedSkills: ['feishu-create-doc', 'feishu-calendar', 'tts'],
    popularity: 91
  }
];

// Get all roles
export function getRoles(query = {}) {
  const { category, difficulty, limit = 20 } = query;
  
  let result = [...roles];
  
  if (category) {
    result = result.filter(r => r.category.toLowerCase() === category.toLowerCase());
  }
  
  if (difficulty) {
    result = result.filter(r => r.difficulty.toLowerCase() === difficulty.toLowerCase());
  }
  
  return {
    data: result.slice(0, parseInt(limit)),
    total: result.length
  };
}

// Get featured roles
export function getFeaturedRoles() {
  const featured = roles
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 4);
  
  return { data: featured };
}

// Get all categories
export function getCategories() {
  const categories = [...new Set(roles.map(r => r.category))];
  return { data: categories };
}

// Search roles
export function searchRoles(q) {
  if (!q) {
    return { data: [] };
  }
  
  const query = q.toLowerCase();
  const result = roles.filter(r => 
    r.name.toLowerCase().includes(query) ||
    r.description.toLowerCase().includes(query) ||
    r.category.toLowerCase().includes(query) ||
    r.abilities.some(a => a.toLowerCase().includes(query))
  );
  
  return { data: result };
}

// Get single role by ID
export function getRoleById(id) {
  const role = roles.find(r => r.id === id);
  return role ? { data: role } : null;
}

// Export roles for use in other modules
export { roles };
