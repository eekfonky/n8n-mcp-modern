/**
 * Comprehensive n8n Node Registry
 * Since node-types API endpoint is not available in public API, we generate tools
 * for all standard n8n nodes + common community nodes
 */

export interface NodeTemplate {
  name: string
  displayName: string
  description: string
  category: string
  commonOperations: string[]
}

/**
 * Core n8n nodes that should be available in any n8n instance
 */
export const CORE_N8N_NODES: NodeTemplate[] = [
  // Core workflow nodes
  { name: 'n8n-nodes-base.start', displayName: 'Start', description: 'Start workflow execution', category: 'Core', commonOperations: ['trigger'] },
  { name: 'n8n-nodes-base.set', displayName: 'Edit Fields', description: 'Set/modify data fields', category: 'Core', commonOperations: ['set', 'edit', 'transform'] },
  { name: 'n8n-nodes-base.if', displayName: 'IF', description: 'Conditional logic branching', category: 'Core', commonOperations: ['condition', 'branch', 'logic'] },
  { name: 'n8n-nodes-base.merge', displayName: 'Merge', description: 'Merge data from multiple sources', category: 'Core', commonOperations: ['merge', 'combine', 'join'] },
  { name: 'n8n-nodes-base.code', displayName: 'Code', description: 'Execute custom JavaScript code', category: 'Core', commonOperations: ['execute', 'javascript', 'custom'] },

  // HTTP and API nodes
  { name: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', description: 'Make HTTP requests to any API', category: 'Core', commonOperations: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
  { name: 'n8n-nodes-base.webhook', displayName: 'Webhook', description: 'Listen for incoming webhooks', category: 'Core', commonOperations: ['listen', 'receive', 'trigger'] },

  // Data transformation
  { name: 'n8n-nodes-base.itemLists', displayName: 'Item Lists', description: 'Split/aggregate item lists', category: 'Core', commonOperations: ['split', 'aggregate', 'limit'] },
  { name: 'n8n-nodes-base.dateTime', displayName: 'Date & Time', description: 'Work with dates and times', category: 'Core', commonOperations: ['format', 'add', 'subtract', 'parse'] },
  { name: 'n8n-nodes-base.json', displayName: 'JSON', description: 'Parse and manipulate JSON data', category: 'Core', commonOperations: ['parse', 'stringify', 'extract'] },

  // Communication nodes
  { name: 'n8n-nodes-base.emailSend', displayName: 'Send Email', description: 'Send emails via SMTP', category: 'Communication', commonOperations: ['send', 'compose', 'attach'] },
  { name: 'n8n-nodes-base.slack', displayName: 'Slack', description: 'Send messages and interact with Slack', category: 'Communication', commonOperations: ['postMessage', 'addReaction', 'setChannelTopic'] },
  { name: 'n8n-nodes-base.discord', displayName: 'Discord', description: 'Send messages to Discord channels', category: 'Communication', commonOperations: ['sendMessage', 'editMessage', 'deleteMessage'] },

  // Database nodes
  { name: 'n8n-nodes-base.postgres', displayName: 'PostgreSQL', description: 'Execute PostgreSQL queries', category: 'Database', commonOperations: ['executeQuery', 'insert', 'update', 'delete'] },
  { name: 'n8n-nodes-base.mysql', displayName: 'MySQL', description: 'Execute MySQL queries', category: 'Database', commonOperations: ['executeQuery', 'insert', 'update', 'delete'] },
  { name: 'n8n-nodes-base.mongodb', displayName: 'MongoDB', description: 'Work with MongoDB collections', category: 'Database', commonOperations: ['findDocuments', 'insertDocument', 'updateDocument', 'deleteDocument'] },
  { name: 'n8n-nodes-base.redis', displayName: 'Redis', description: 'Execute Redis operations', category: 'Database', commonOperations: ['get', 'set', 'delete', 'publish'] },

  // Cloud services
  { name: 'n8n-nodes-base.googleSheets', displayName: 'Google Sheets', description: 'Read/write Google Sheets', category: 'Google', commonOperations: ['append', 'read', 'update', 'clear'] },
  { name: 'n8n-nodes-base.googleDrive', displayName: 'Google Drive', description: 'Manage Google Drive files', category: 'Google', commonOperations: ['upload', 'download', 'delete', 'list'] },
  { name: 'n8n-nodes-base.googleGmail', displayName: 'Gmail', description: 'Send and manage Gmail messages', category: 'Google', commonOperations: ['send', 'get', 'list', 'delete'] },

  // Microsoft services
  { name: 'n8n-nodes-base.microsoftExcel', displayName: 'Microsoft Excel', description: 'Work with Excel spreadsheets', category: 'Microsoft', commonOperations: ['append', 'read', 'update', 'delete'] },
  { name: 'n8n-nodes-base.microsoftOneDrive', displayName: 'OneDrive', description: 'Manage OneDrive files', category: 'Microsoft', commonOperations: ['upload', 'download', 'delete', 'list'] },
  { name: 'n8n-nodes-base.microsoftOutlook', displayName: 'Outlook', description: 'Manage Outlook emails and calendar', category: 'Microsoft', commonOperations: ['sendMessage', 'getMessage', 'createEvent'] },

  // AWS services
  { name: 'n8n-nodes-base.awsS3', displayName: 'AWS S3', description: 'Interact with AWS S3 buckets', category: 'AWS', commonOperations: ['upload', 'download', 'delete', 'list'] },
  { name: 'n8n-nodes-base.awsLambda', displayName: 'AWS Lambda', description: 'Invoke AWS Lambda functions', category: 'AWS', commonOperations: ['invoke'] },
  { name: 'n8n-nodes-base.awsSes', displayName: 'AWS SES', description: 'Send emails via AWS SES', category: 'AWS', commonOperations: ['sendEmail', 'sendBulkEmail'] },

  // Popular APIs
  { name: 'n8n-nodes-base.github', displayName: 'GitHub', description: 'Interact with GitHub repositories', category: 'Development', commonOperations: ['createRepository', 'createIssue', 'createPullRequest'] },
  { name: 'n8n-nodes-base.gitlab', displayName: 'GitLab', description: 'Interact with GitLab projects', category: 'Development', commonOperations: ['createProject', 'createIssue', 'createMergeRequest'] },
  { name: 'n8n-nodes-base.jira', displayName: 'Jira', description: 'Manage Jira issues and projects', category: 'Project Management', commonOperations: ['createIssue', 'updateIssue', 'getIssue'] },
  { name: 'n8n-nodes-base.notion', displayName: 'Notion', description: 'Work with Notion databases and pages', category: 'Productivity', commonOperations: ['createPage', 'updatePage', 'getDatabaseItems'] },

  // E-commerce
  { name: 'n8n-nodes-base.shopify', displayName: 'Shopify', description: 'Manage Shopify store data', category: 'E-commerce', commonOperations: ['getProducts', 'createProduct', 'updateProduct', 'getOrders'] },
  { name: 'n8n-nodes-base.wooCommerce', displayName: 'WooCommerce', description: 'Manage WooCommerce store data', category: 'E-commerce', commonOperations: ['getProducts', 'createProduct', 'getOrders'] },

  // Social Media
  { name: 'n8n-nodes-base.twitter', displayName: 'Twitter', description: 'Post tweets and interact with Twitter', category: 'Social Media', commonOperations: ['tweet', 'search', 'followUser'] },
  { name: 'n8n-nodes-base.linkedin', displayName: 'LinkedIn', description: 'Share posts on LinkedIn', category: 'Social Media', commonOperations: ['shareUpdate', 'getProfile'] },

  // File operations
  { name: 'n8n-nodes-base.readBinaryFile', displayName: 'Read Binary File', description: 'Read binary files from filesystem', category: 'Files', commonOperations: ['read'] },
  { name: 'n8n-nodes-base.writeBinaryFile', displayName: 'Write Binary File', description: 'Write binary files to filesystem', category: 'Files', commonOperations: ['write'] },
  { name: 'n8n-nodes-base.ftp', displayName: 'FTP', description: 'Transfer files via FTP', category: 'Files', commonOperations: ['list', 'get', 'put', 'delete'] },

  // Scheduling
  { name: 'n8n-nodes-base.cron', displayName: 'Schedule Trigger', description: 'Trigger workflows on schedule', category: 'Core', commonOperations: ['schedule'] },
  { name: 'n8n-nodes-base.interval', displayName: 'Interval', description: 'Trigger workflows at intervals', category: 'Core', commonOperations: ['trigger'] },

  // Utilities
  { name: 'n8n-nodes-base.wait', displayName: 'Wait', description: 'Pause workflow execution', category: 'Core', commonOperations: ['wait'] },
  { name: 'n8n-nodes-base.errorTrigger', displayName: 'Error Trigger', description: 'Handle workflow errors', category: 'Core', commonOperations: ['catch', 'handle'] },
  { name: 'n8n-nodes-base.noOp', displayName: 'No Operation', description: 'Do nothing (useful for testing)', category: 'Core', commonOperations: ['noop'] },
]

/**
 * Common community nodes that might be installed
 */
export const COMMUNITY_NODES: NodeTemplate[] = [
  { name: 'n8n-nodes-supabase', displayName: 'Supabase', description: 'Interact with Supabase database', category: 'Database', commonOperations: ['select', 'insert', 'update', 'delete'] },
  { name: 'n8n-nodes-openai', displayName: 'OpenAI', description: 'Use OpenAI GPT models', category: 'AI', commonOperations: ['complete', 'chat', 'embed'] },
  { name: 'n8n-nodes-anthropic', displayName: 'Anthropic Claude', description: 'Use Anthropic Claude AI', category: 'AI', commonOperations: ['complete', 'chat'] },
  { name: 'n8n-nodes-airtable', displayName: 'Airtable', description: 'Work with Airtable bases', category: 'Database', commonOperations: ['list', 'create', 'update', 'delete'] },
  { name: 'n8n-nodes-strapi', displayName: 'Strapi', description: 'Interact with Strapi CMS', category: 'CMS', commonOperations: ['find', 'create', 'update', 'delete'] },
  { name: 'n8n-nodes-firebase', displayName: 'Firebase', description: 'Work with Firebase services', category: 'Google', commonOperations: ['get', 'set', 'update', 'delete'] },
  { name: 'n8n-nodes-whatsapp', displayName: 'WhatsApp Business', description: 'Send WhatsApp messages', category: 'Communication', commonOperations: ['sendMessage', 'sendTemplate'] },
]

/**
 * Get all available node templates
 */
export function getAllNodeTemplates(): NodeTemplate[] {
  return [...CORE_N8N_NODES, ...COMMUNITY_NODES]
}

/**
 * Get nodes by category
 */
export function getNodesByCategory(category: string): NodeTemplate[] {
  return getAllNodeTemplates().filter(node => node.category === category)
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  return [...new Set(getAllNodeTemplates().map(node => node.category))]
}
