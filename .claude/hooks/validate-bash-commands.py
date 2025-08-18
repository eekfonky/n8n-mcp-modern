#!/usr/bin/env python3
"""
Bash command validation for n8n-MCP Modern project.
Ensures commands follow project best practices and security guidelines.
"""
import json
import sys
import re

# Command recommendations and validations
COMMAND_RULES = [
    # Performance optimizations
    (r'\bgrep\b(?!.*\brg\b)', 'Use "rg" (ripgrep) instead of "grep" for better performance'),
    (r'\bfind\s+.*-name\b', 'Consider using "rg --files -g pattern" instead of "find -name" for better performance'),
    (r'\bcat\s+.*\|.*grep\b', 'Use "rg pattern file" instead of "cat file | grep pattern"'),
    
    # Security validations
    (r'\brm\s+-rf?\s+/', 'Dangerous: Attempting to remove from root directory'),
    (r'\bchmod\s+777\b', 'Security risk: chmod 777 gives full permissions to all users'),
    (r'\bsudo\s+rm\b', 'Caution: Using sudo rm - ensure this is necessary'),
    (r'>\s*/dev/null\s+2>&1.*rm\b', 'Suspicious: Silencing errors while removing files'),
    
    # Project-specific validations
    (r'\bnpm\s+install\s+(?!-g)', 'Use "npm ci" for consistent installs in CI/production'),
    (r'\bgit\s+push\s+--force(?!\s|$)', 'Dangerous: Force push can overwrite history'),
    (r'\bdocker\s+run.*--privileged\b', 'Security risk: Docker privileged mode'),
    
    # n8n specific patterns
    (r'\bn8n\s+start\b', 'For n8n testing, ensure proper environment configuration'),
    (r'curl.*n8n.*api.*-X\s+(DELETE|PUT)', 'Caution: Destructive n8n API operation'),
]

# Allowed destructive commands (require extra validation)
DESTRUCTIVE_WHITELIST = [
    'npm run clean',
    'npm run build',
    'npm run rebuild-db',
    'rm -rf dist',
    'rm -rf node_modules',
    'rm -f *.log',
]

# Commands that should use project scripts instead
SCRIPT_ALTERNATIVES = {
    r'tsc\s+--noEmit': 'npm run typecheck',
    r'eslint\s+': 'npm run lint',
    r'vitest\s+': 'npm test',
    r'prettier\s+': 'npm run format (if available)',
}

def validate_command(command):
    """Validate a bash command against project rules."""
    issues = []
    warnings = []
    
    # Check against validation rules
    for pattern, message in COMMAND_RULES:
        if re.search(pattern, command, re.IGNORECASE):
            if 'Dangerous:' in message or 'Security risk:' in message:
                issues.append(message)
            else:
                warnings.append(message)
    
    # Check for script alternatives
    for pattern, alternative in SCRIPT_ALTERNATIVES.items():
        if re.search(pattern, command, re.IGNORECASE):
            warnings.append(f'Consider using "{alternative}" instead')
    
    # Check if destructive command is whitelisted
    is_destructive = any(keyword in command.lower() for keyword in ['rm ', 'delete', 'drop', 'truncate'])
    if is_destructive:
        is_whitelisted = any(whitelist in command for whitelist in DESTRUCTIVE_WHITELIST)
        if not is_whitelisted:
            issues.append(f'Destructive command not in whitelist: {command}')
    
    return issues, warnings

def suggest_improvements(command):
    """Suggest improvements for the command."""
    suggestions = []
    
    # Suggest using project root variable
    if '/home/' in command or '../' in command:
        suggestions.append('Consider using $CLAUDE_PROJECT_DIR for project-relative paths')
    
    # Suggest error handling
    if '&&' not in command and '||' not in command and 'set -e' not in command:
        if any(cmd in command for cmd in ['rm', 'mv', 'cp', 'curl']):
            suggestions.append('Consider adding error handling with && or || operators')
    
    return suggestions

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        if tool_name != "Bash":
            sys.exit(0)  # Not a bash command
        
        command = tool_input.get("command", "")
        description = tool_input.get("description", "")
        
        if not command:
            sys.exit(0)  # No command to validate
        
        # Validate the command
        issues, warnings = validate_command(command)
        suggestions = suggest_improvements(command)
        
        # Handle blocking issues
        if issues:
            print(f"❌ Bash Command Validation Failed:", file=sys.stderr)
            print(f"   Command: {command}", file=sys.stderr)
            for issue in issues:
                print(f"   • {issue}", file=sys.stderr)
            sys.exit(2)  # Block the command
        
        # Show warnings and suggestions
        if warnings or suggestions:
            print(f"⚠️  Bash Command Recommendations:")
            print(f"   Command: {command}")
            
            for warning in warnings:
                print(f"   • {warning}")
            
            for suggestion in suggestions:
                print(f"   💡 {suggestion}")
        
        # Allow the command
        sys.exit(0)
    
    except Exception as e:
        print(f"Error validating bash command: {e}", file=sys.stderr)
        sys.exit(1)  # Non-blocking error

if __name__ == "__main__":
    main()