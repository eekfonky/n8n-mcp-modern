#!/usr/bin/env python3
"""
n8n context injection for user prompts.
Provides relevant n8n-MCP project context and routing guidance.
"""
import json
import sys
import os
import re
from datetime import datetime

# Project context information
PROJECT_CONTEXT = {
    "name": "n8n-MCP Modern",
    "version": "4.3.0",
    "architecture": "Modern TypeScript ESM with MCP SDK",
    "agents": [
        "n8n-workflow-architect (purple) - Master coordinator",
        "n8n-developer-specialist (blue) - Code generation & DevOps", 
        "n8n-integration-specialist (yellow) - Authentication & connectivity",
        "n8n-node-specialist (orange) - 525+ node expertise",
        "n8n-performance-specialist (red) - Monitoring & optimization",
        "n8n-guidance-specialist (green) - Documentation & support"
    ],
    "tools": "98 MCP tools for complete n8n automation",
    "key_files": {
        "src/tools/": "98 MCP tool implementations",
        "src/agents/": "Agent routing and context management", 
        "src/database/": "SQLite node database with 525+ nodes",
        "src/n8n/": "N8N API integration layer",
        "data/": "Node database and configuration files"
    }
}

# Routing suggestions based on prompt keywords
ROUTING_SUGGESTIONS = [
    {
        'keywords': ['workflow', 'create', 'generate', 'build', 'automation'],
        'agent': 'n8n-developer-specialist',
        'reason': 'For workflow creation and code generation'
    },
    {
        'keywords': ['oauth', 'auth', 'api', 'webhook', 'integrate', 'connect'],
        'agent': 'n8n-integration-specialist', 
        'reason': 'For authentication and API connectivity'
    },
    {
        'keywords': ['node', 'ai', 'ml', 'llm', 'which node', 'best node'],
        'agent': 'n8n-node-specialist',
        'reason': 'For node selection and AI/ML workflows'
    },
    {
        'keywords': ['monitor', 'performance', 'slow', 'optimize', 'alert'],
        'agent': 'n8n-performance-specialist',
        'reason': 'For performance monitoring and optimization'
    },
    {
        'keywords': ['help', 'how to', 'guide', 'tutorial', 'getting started'],
        'agent': 'n8n-guidance-specialist',
        'reason': 'For documentation and guidance'
    },
    {
        'keywords': ['complex', 'multi-system', 'strategic', 'planning', 'architecture'],
        'agent': 'n8n-workflow-architect',
        'reason': 'For strategic planning and complex orchestration'
    }
]

def detect_context_needs(prompt):
    """Detect what context might be helpful for the prompt."""
    prompt_lower = prompt.lower()
    context_needs = []
    
    # Technical context
    if any(term in prompt_lower for term in ['error', 'bug', 'issue', 'problem', 'fail']):
        context_needs.append('debugging')
    
    if any(term in prompt_lower for term in ['test', 'spec', 'validation']):
        context_needs.append('testing')
        
    if any(term in prompt_lower for term in ['deploy', 'build', 'production']):
        context_needs.append('deployment')
        
    if any(term in prompt_lower for term in ['typescript', 'type', 'interface']):
        context_needs.append('typescript')
        
    return context_needs

def suggest_agent_routing(prompt):
    """Suggest appropriate agent based on prompt content."""
    prompt_lower = prompt.lower()
    
    for suggestion in ROUTING_SUGGESTIONS:
        keyword_matches = sum(1 for keyword in suggestion['keywords'] if keyword in prompt_lower)
        if keyword_matches > 0:
            return suggestion
    
    return None

def get_project_status():
    """Get current project status."""
    try:
        # Check if in project directory
        project_dir = os.environ.get('CLAUDE_PROJECT_DIR', '.')
        
        status = {
            'timestamp': datetime.now().isoformat(),
            'project_ready': os.path.exists(os.path.join(project_dir, 'package.json')),
            'agents_available': os.path.exists(os.path.join(project_dir, '.claude/agents')),
            'database_available': os.path.exists(os.path.join(project_dir, 'data')),
        }
        
        return status
    except Exception:
        return {'timestamp': datetime.now().isoformat(), 'status': 'unknown'}

def generate_context(prompt, context_needs, routing_suggestion, project_status):
    """Generate contextual information for the prompt."""
    context_parts = []
    
    # Project identification
    context_parts.append(f"📦 **Current Project**: {PROJECT_CONTEXT['name']} v{PROJECT_CONTEXT['version']}")
    context_parts.append(f"🏗️  **Architecture**: {PROJECT_CONTEXT['architecture']}")
    
    # Agent routing suggestion
    if routing_suggestion:
        context_parts.append(f"\n🎯 **Suggested Agent**: @{routing_suggestion['agent']}")
        context_parts.append(f"   {routing_suggestion['reason']}")
        context_parts.append(f"   Available: {PROJECT_CONTEXT['agents']}")
    
    # Context-specific information
    if 'debugging' in context_needs:
        context_parts.append(f"\n🐛 **Debug Context**: Use `npm test` for testing, check logs in debug mode")
        
    if 'testing' in context_needs:
        context_parts.append(f"\n🧪 **Test Context**: 158 tests available via Vitest, 100% pass rate achieved")
        
    if 'deployment' in context_needs:
        context_parts.append(f"\n🚀 **Deploy Context**: NPM package @lexinet/n8n-mcp-modern, binary: n8n-mcp")
        
    if 'typescript' in context_needs:
        context_parts.append(f"\n📝 **TypeScript Context**: Strict mode, ESM-only, Node 22+ target")
    
    # Project status
    if not project_status.get('project_ready'):
        context_parts.append(f"\n⚠️  **Status**: Project structure not detected in current directory")
    
    return '\n'.join(context_parts)

def main():
    try:
        input_data = json.load(sys.stdin)
        prompt = input_data.get("prompt", "")
        
        if not prompt.strip():
            sys.exit(0)  # Empty prompt
        
        # Skip context injection for very short prompts
        if len(prompt.strip()) < 10:
            sys.exit(0)
        
        # Skip if prompt already contains agent routing
        if '@n8n-' in prompt or 'agent' in prompt.lower():
            sys.exit(0)
        
        # Analyze the prompt
        context_needs = detect_context_needs(prompt)
        routing_suggestion = suggest_agent_routing(prompt)
        project_status = get_project_status()
        
        # Generate context only if relevant
        if context_needs or routing_suggestion or not project_status.get('project_ready'):
            context = generate_context(prompt, context_needs, routing_suggestion, project_status)
            print(f"\n{context}\n")
        
        sys.exit(0)
    
    except Exception as e:
        # Silently fail for context injection to avoid disrupting workflow
        sys.exit(0)

if __name__ == "__main__":
    main()