#!/usr/bin/env python3
"""
File protection hook for n8n-MCP Modern project.
Prevents accidental modification of critical files and maintains project integrity.
"""
import json
import sys
import os
import re

# Protected files and directories
PROTECTED_PATTERNS = [
    # Package and lock files
    r'package-lock\.json$',
    r'yarn\.lock$',
    r'pnpm-lock\.yaml$',
    
    # Environment and secrets
    r'\.env',
    r'\.env\..*',
    r'secrets\..*',
    
    # Git and version control
    r'\.git/',
    r'\.gitignore$',
    
    # Build and distribution
    r'dist/',
    r'build/',
    r'node_modules/',
    
    # Critical project files
    r'LICENSE$',
    r'\.github/workflows/',
    
    # Database files (read-only)
    r'data/.*\.db$',
    r'data/.*\.sqlite$',
]

# Files requiring extra validation
VALIDATION_REQUIRED = [
    r'package\.json$',
    r'tsconfig\.json$',
    r'vitest\.config\.',
    r'\.mcp\.json$',
    r'CLAUDE\.md$',
]

def is_protected_file(file_path):
    """Check if file is protected from modification."""
    for pattern in PROTECTED_PATTERNS:
        if re.search(pattern, file_path):
            return True, f"Protected file pattern: {pattern}"
    return False, None

def requires_validation(file_path):
    """Check if file requires extra validation."""
    for pattern in VALIDATION_REQUIRED:
        if re.search(pattern, file_path):
            return True, pattern
    return False, None

def validate_package_json_changes(file_path, content=None):
    """Special validation for package.json changes."""
    try:
        if content:
            data = json.loads(content)
        else:
            with open(file_path, 'r') as f:
                data = json.load(f)
        
        # Check for critical field modifications
        critical_fields = ['name', 'version', 'main', 'bin', 'engines']
        warnings = []
        
        for field in critical_fields:
            if field in data:
                if field == 'name' and data[field] != '@lexinet/n8n-mcp-modern':
                    warnings.append(f"Package name should remain '@lexinet/n8n-mcp-modern'")
                elif field == 'main' and data[field] != 'dist/index.js':
                    warnings.append(f"Main entry should remain 'dist/index.js'")
                elif field == 'bin' and not isinstance(data[field], dict):
                    warnings.append(f"Binary configuration should be preserved")
        
        return warnings
    except Exception as e:
        return [f"Invalid JSON in package.json: {e}"]

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        if tool_name not in ["Edit", "MultiEdit", "Write"]:
            sys.exit(0)  # Not a file modification
        
        file_path = tool_input.get("file_path", "")
        content = tool_input.get("content", "") if tool_name == "Write" else None
        
        if not file_path:
            sys.exit(0)  # No file path provided
        
        # Normalize path
        normalized_path = os.path.normpath(file_path)
        
        # Check if file is protected
        is_protected, protection_reason = is_protected_file(normalized_path)
        if is_protected:
            print(f"❌ File Protection Violation:", file=sys.stderr)
            print(f"   Cannot modify protected file: {normalized_path}", file=sys.stderr)
            print(f"   Reason: {protection_reason}", file=sys.stderr)
            print(f"   Use manual editing with extra caution if modification is necessary", file=sys.stderr)
            sys.exit(2)  # Block the operation
        
        # Check if file requires validation
        needs_validation, validation_pattern = requires_validation(normalized_path)
        if needs_validation:
            print(f"⚠️  Critical file modification detected: {normalized_path}", file=sys.stderr)
            
            # Special validation for package.json
            if 'package\.json' in validation_pattern:
                warnings = validate_package_json_changes(file_path, content)
                if warnings:
                    print(f"❌ Package.json validation failed:", file=sys.stderr)
                    for warning in warnings:
                        print(f"   • {warning}", file=sys.stderr)
                    sys.exit(2)  # Block invalid package.json changes
            
            print(f"   Please ensure changes maintain project integrity", file=sys.stderr)
        
        # Allow the operation
        print(f"✅ File modification approved: {normalized_path}")
        sys.exit(0)
    
    except Exception as e:
        print(f"Error in file protection hook: {e}", file=sys.stderr)
        sys.exit(1)  # Non-blocking error

if __name__ == "__main__":
    main()