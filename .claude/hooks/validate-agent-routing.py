#!/usr/bin/env python3
"""
Agent routing validation for n8n-MCP Modern project.
Ensures queries go to appropriate specialists and agents stay focused.
"""
import json
import sys
import re

# Agent specializations and their keywords
AGENT_SPECIALIZATIONS = {
    'n8n-workflow-architect': {
        'keywords': ['strategic', 'planning', 'coordination', 'architecture', 'complex', 'multi-system', 'orchestration'],
        'description': 'Master coordinator for strategic planning and complex orchestration'
    },
    'n8n-developer-specialist': {
        'keywords': ['code', 'generate', 'template', 'workflow', 'docker', 'devops', 'ci/cd', 'development'],
        'description': 'Code generation, development templates, and DevOps workflows'
    },
    'n8n-integration-specialist': {
        'keywords': ['oauth', 'auth', 'api', 'webhook', 'integration', 'connectivity', 'credential'],
        'description': 'Authentication & connectivity expert for OAuth, APIs, webhooks'
    },
    'n8n-node-specialist': {
        'keywords': ['node', 'ai', 'ml', 'llm', 'vector', 'embedding', '525', 'community'],
        'description': 'Expert for 525+ n8n nodes, AI/ML workflows, community patterns'
    },
    'n8n-performance-specialist': {
        'keywords': ['monitor', 'performance', 'optimize', 'alert', 'dashboard', 'sla', 'analytics'],
        'description': 'Monitoring, optimization, and analytics specialist'
    },
    'n8n-guidance-specialist': {
        'keywords': ['help', 'guide', 'tutorial', 'documentation', 'getting started', 'how to'],
        'description': 'Documentation, tutorials, and general guidance'
    }
}

# Invalid patterns that should be blocked
INVALID_PATTERNS = [
    (r'(?i)create.*agent', 'Use existing n8n agents instead of creating new ones'),
    (r'(?i)general.*purpose', 'Route to specific n8n specialist instead of general-purpose'),
    (r'(?i)write.*code.*general', 'Route to n8n-developer-specialist for code generation'),
    (r'(?i)fix.*bug.*general', 'Route to appropriate n8n specialist based on issue domain'),
]

def analyze_agent_query(prompt, agent_type):
    """Analyze if the query is appropriate for the requested agent."""
    
    if not agent_type:
        return True, "No specific agent requested"
    
    # Extract agent name from task prompt or parameters
    agent_match = None
    for agent_name in AGENT_SPECIALIZATIONS:
        if agent_name in prompt.lower() or agent_name in agent_type.lower():
            agent_match = agent_name
            break
    
    if not agent_match:
        # Check if it's a general-purpose request that should be routed
        for pattern, message in INVALID_PATTERNS:
            if re.search(pattern, prompt):
                return False, f"Routing issue: {message}"
        return True, "No specific agent routing detected"
    
    # Validate the request matches the agent's specialization
    specialization = AGENT_SPECIALIZATIONS[agent_match]
    prompt_lower = prompt.lower()
    
    # Check if prompt contains relevant keywords
    keyword_matches = sum(1 for keyword in specialization['keywords'] if keyword in prompt_lower)
    
    if keyword_matches == 0:
        suggestion = suggest_better_agent(prompt)
        return False, f"Query doesn't match {agent_match} specialization. {suggestion}"
    
    return True, f"✓ Appropriate routing to {agent_match}"

def suggest_better_agent(prompt):
    """Suggest a better agent based on prompt content."""
    prompt_lower = prompt.lower()
    best_match = None
    best_score = 0
    
    for agent_name, spec in AGENT_SPECIALIZATIONS.items():
        score = sum(1 for keyword in spec['keywords'] if keyword in prompt_lower)
        if score > best_score:
            best_score = score
            best_match = agent_name
    
    if best_match and best_score > 0:
        return f"Consider routing to {best_match}: {AGENT_SPECIALIZATIONS[best_match]['description']}"
    
    return "Consider routing to n8n-guidance-specialist for general n8n questions"

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        if tool_name != "Task":
            sys.exit(0)  # Not a subagent task
        
        prompt = tool_input.get("prompt", "")
        agent_type = tool_input.get("subagent_type", "")
        
        is_valid, message = analyze_agent_query(prompt, agent_type)
        
        if not is_valid:
            # Block the routing and provide feedback
            print(f"❌ Agent Routing Validation Failed:", file=sys.stderr)
            print(f"   {message}", file=sys.stderr)
            print(f"   Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}", file=sys.stderr)
            sys.exit(2)  # Block with feedback to Claude
        else:
            # Allow the routing
            print(f"✅ Agent routing validated: {message}")
            sys.exit(0)
    
    except Exception as e:
        print(f"Error validating agent routing: {e}", file=sys.stderr)
        sys.exit(1)  # Non-blocking error

if __name__ == "__main__":
    main()