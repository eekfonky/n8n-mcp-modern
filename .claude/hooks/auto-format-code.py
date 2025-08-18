#!/usr/bin/env python3
"""
Auto-formatting hook for n8n-MCP Modern project.
Automatically formats code files according to project standards.
"""
import json
import sys
import os
import subprocess
import re

# File type mappings to formatters
FORMATTERS = {
    '.ts': ['npx', 'prettier', '--write'],
    '.js': ['npx', 'prettier', '--write'],
    '.json': ['npx', 'prettier', '--write'],
    '.md': ['npx', 'prettier', '--write'],
    '.yaml': ['npx', 'prettier', '--write'],
    '.yml': ['npx', 'prettier', '--write'],
}

# Files to skip formatting
SKIP_PATTERNS = [
    r'node_modules/',
    r'dist/',
    r'build/',
    r'\.git/',
    r'package-lock\.json$',
    r'.*\.min\.(js|css)$',
    r'data/.*\.json$',  # Database files
]

# TypeScript specific validations
TS_VALIDATIONS = [
    (r'any\s+(?!\/\/|\*)', 'Consider using proper TypeScript types instead of "any"'),
    (r'console\.(log|error|warn)', 'Consider using the project logger instead of console'),
    (r'@ts-ignore', 'Avoid @ts-ignore - fix the TypeScript issue instead'),
    (r'Function\s*\(', 'Avoid Function constructor - use arrow functions or function declarations'),
]

# JavaScript specific validations
JS_VALIDATIONS = [
    (r'console\.(log|error|warn)', 'Consider using the project logger instead of console'),
    (r'Function\s*\(', 'Avoid Function constructor - use arrow functions or function declarations'),
    (r'var\s+\w+', 'Consider using "const" or "let" instead of "var"'),
    (r'==(?!=)', 'Consider using strict equality "===" instead of "=="'),
    (r'!=(?!=)', 'Consider using strict inequality "!==" instead of "!="'),
    (r'eval\s*\(', 'Avoid eval() - it can be a security risk'),
    (r'with\s*\(', 'Avoid "with" statements - they are deprecated and confusing'),
    (r'document\.write\s*\(', 'Avoid document.write - use modern DOM manipulation'),
]

# JSON specific validations for n8n node definitions
JSON_VALIDATIONS = [
    (r'"displayName":\s*""', 'displayName should not be empty in n8n node definitions'),
    (r'"name":\s*""', 'name should not be empty in n8n node definitions'),
    (r'"version":\s*[^1-9]', 'version should start with 1 or higher in n8n nodes'),
    (r'"description":\s*""', 'description should be provided for better UX'),
    (r'"properties":\s*\{\s*\}', 'properties should contain at least one field for n8n nodes'),
    (r'"credentials":\s*\[\s*\]', 'Consider adding credential requirements if API access is needed'),
    (r'"inputs":\s*\[\s*\]', 'Most n8n nodes should accept at least one input'),
    (r'"outputs":\s*\[\s*\]', 'Most n8n nodes should produce at least one output'),
]

# Markdown validations for documentation and agent files
MD_VALIDATIONS = [
    (r'^#\s*$', 'Empty headers should have content'),
    (r'```\s*\n(?!.*\n```)', 'Code blocks should be properly closed'),
    (r'\[.*\]\(\s*\)', 'Links should have valid URLs'),
    (r'!\[.*\]\(\s*\)', 'Images should have valid paths'),
    (r'TODO(?!:)', 'TODO items should be formatted as "TODO: description"'),
    (r'FIXME(?!:)', 'FIXME items should be formatted as "FIXME: description"'),
    (r'(?i)claude.*code.*agent', 'Agent documentation detected - ensure YAML frontmatter is present'),
]

# YAML validations for configuration files
YAML_VALIDATIONS = [
    (r'^\s+\t', 'Use spaces instead of tabs for YAML indentation'),
    (r':\s*$', 'YAML values should not be empty'),
    (r'name:\s*$', 'name field should have a value'),
    (r'version:\s*$', 'version field should have a value'),
    (r'description:\s*$', 'description field should have a value'),
    (r'---\s*$', 'YAML frontmatter should have content between --- markers'),
]

def should_skip_file(file_path):
    """Check if file should be skipped from formatting."""
    for pattern in SKIP_PATTERNS:
        if re.search(pattern, file_path):
            return True
    return False

def format_file(file_path):
    """Format a file using the appropriate formatter."""
    file_ext = os.path.splitext(file_path)[1].lower()
    
    if file_ext not in FORMATTERS:
        return True, f"No formatter configured for {file_ext} files"
    
    if should_skip_file(file_path):
        return True, f"Skipped formatting (excluded pattern)"
    
    if not os.path.exists(file_path):
        return True, f"File does not exist: {file_path}"
    
    try:
        formatter_cmd = FORMATTERS[file_ext] + [file_path]
        result = subprocess.run(
            formatter_cmd,
            capture_output=True,
            text=True,
            timeout=30,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode == 0:
            return True, f"✅ Formatted {file_path}"
        else:
            return False, f"Formatter failed: {result.stderr.strip()}"
    
    except subprocess.TimeoutExpired:
        return False, f"Formatter timeout for {file_path}"
    except Exception as e:
        return False, f"Formatter error: {str(e)}"

def validate_typescript(file_path, content=None):
    """Validate TypeScript code against project standards."""
    if not file_path.endswith(('.ts', '.tsx')):
        return []
    
    try:
        if content is None:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        warnings = []
        
        for pattern, message in TS_VALIDATIONS:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                warnings.append(f"Line {line_num}: {message}")
        
        return warnings
    
    except Exception as e:
        return [f"Error validating TypeScript: {e}"]

def validate_javascript(file_path, content=None):
    """Validate JavaScript code against project standards."""
    if not file_path.endswith(('.js', '.jsx', '.mjs')):
        return []
    
    try:
        if content is None:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        warnings = []
        
        for pattern, message in JS_VALIDATIONS:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                warnings.append(f"Line {line_num}: {message}")
        
        return warnings
    
    except Exception as e:
        return [f"Error validating JavaScript: {e}"]

def validate_json(file_path, content=None):
    """Validate JSON files, especially n8n node definitions."""
    if not file_path.endswith('.json'):
        return []
    
    try:
        if content is None:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        warnings = []
        
        # First, validate JSON syntax
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            return [f"Invalid JSON syntax: {e}"]
        
        # n8n specific validations for node files
        if any(indicator in file_path.lower() for indicator in ['node', 'credential', 'trigger']):
            for pattern, message in JSON_VALIDATIONS:
                matches = re.finditer(pattern, content, re.MULTILINE)
                for match in matches:
                    line_num = content[:match.start()].count('\n') + 1
                    warnings.append(f"Line {line_num}: {message}")
        
        # Package.json specific checks
        if file_path.endswith('package.json'):
            try:
                data = json.loads(content)
                if 'n8n' in str(data) or 'mcp' in str(data):
                    if not data.get('name'):
                        warnings.append('package.json should have a name field')
                    if not data.get('version'):
                        warnings.append('package.json should have a version field')
                    if not data.get('description'):
                        warnings.append('package.json should have a description field')
            except:
                pass  # JSON validation already handled above
        
        return warnings
    
    except Exception as e:
        return [f"Error validating JSON: {e}"]

def validate_markdown(file_path, content=None):
    """Validate Markdown files for documentation and agent definitions."""
    if not file_path.endswith(('.md', '.mdx')):
        return []
    
    try:
        if content is None:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        warnings = []
        
        # Check for YAML frontmatter in agent files
        if any(agent_indicator in file_path for agent_indicator in ['agent', 'specialist']):
            if not content.startswith('---'):
                warnings.append('Agent files should start with YAML frontmatter (---)')
            elif not re.search(r'---.*?name:', content, re.DOTALL):
                warnings.append('Agent frontmatter should include name field')
        
        # General markdown validations
        for pattern, message in MD_VALIDATIONS:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                warnings.append(f"Line {line_num}: {message}")
        
        # Check for proper code block language tags
        code_blocks = re.finditer(r'```(\w*)\n', content)
        for match in code_blocks:
            lang = match.group(1)
            line_num = content[:match.start()].count('\n') + 1
            if not lang:
                warnings.append(f"Line {line_num}: Code block should specify language for syntax highlighting")
        
        return warnings
    
    except Exception as e:
        return [f"Error validating Markdown: {e}"]

def validate_yaml(file_path, content=None):
    """Validate YAML files for configuration and frontmatter."""
    if not file_path.endswith(('.yaml', '.yml')):
        return []
    
    try:
        if content is None:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        
        warnings = []
        
        # Try to parse YAML
        try:
            import yaml
            yaml.safe_load(content)
        except ImportError:
            warnings.append('PyYAML not available for syntax validation')
        except yaml.YAMLError as e:
            return [f"Invalid YAML syntax: {e}"]
        
        # YAML structure validations
        for pattern, message in YAML_VALIDATIONS:
            matches = re.finditer(pattern, content, re.MULTILINE)
            for match in matches:
                line_num = content[:match.start()].count('\n') + 1
                warnings.append(f"Line {line_num}: {message}")
        
        # Docker Compose specific checks
        if 'docker-compose' in file_path or 'compose' in file_path:
            if 'version:' not in content:
                warnings.append('Docker Compose files should specify version')
            if 'services:' not in content:
                warnings.append('Docker Compose files should define services')
        
        return warnings
    
    except Exception as e:
        return [f"Error validating YAML: {e}"]

def run_type_check():
    """Run TypeScript type checking."""
    try:
        result = subprocess.run(
            ['npm', 'run', 'typecheck'],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode == 0:
            return True, "✅ TypeScript validation passed"
        else:
            return False, f"TypeScript errors:\n{result.stdout}\n{result.stderr}"
    
    except subprocess.TimeoutExpired:
        return False, "TypeScript check timeout"
    except Exception as e:
        return False, f"TypeScript check error: {str(e)}"

def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        
        if tool_name not in ["Edit", "MultiEdit", "Write"]:
            sys.exit(0)  # Not a file modification
        
        file_path = tool_input.get("file_path", "")
        
        if not file_path:
            sys.exit(0)  # No file path
        
        # Format the file
        success, message = format_file(file_path)
        
        if not success:
            print(f"⚠️  Formatting Warning: {message}")
        else:
            print(message)
        
        # TypeScript validation
        if file_path.endswith(('.ts', '.tsx')):
            ts_warnings = validate_typescript(file_path)
            if ts_warnings:
                print(f"⚠️  TypeScript Recommendations for {file_path}:")
                for warning in ts_warnings[:5]:  # Limit to first 5 warnings
                    print(f"   • {warning}")
                if len(ts_warnings) > 5:
                    print(f"   ... and {len(ts_warnings) - 5} more warnings")
        
        # JavaScript validation
        elif file_path.endswith(('.js', '.jsx', '.mjs')):
            js_warnings = validate_javascript(file_path)
            if js_warnings:
                print(f"⚠️  JavaScript Recommendations for {file_path}:")
                for warning in js_warnings[:5]:  # Limit to first 5 warnings
                    print(f"   • {warning}")
                if len(js_warnings) > 5:
                    print(f"   ... and {len(js_warnings) - 5} more warnings")
        
        # JSON validation (n8n nodes, package.json, config files)
        elif file_path.endswith('.json'):
            json_warnings = validate_json(file_path)
            if json_warnings:
                print(f"⚠️  JSON Recommendations for {file_path}:")
                for warning in json_warnings[:5]:
                    print(f"   • {warning}")
                if len(json_warnings) > 5:
                    print(f"   ... and {len(json_warnings) - 5} more warnings")
        
        # Markdown validation (documentation, agent files, README)
        elif file_path.endswith(('.md', '.mdx')):
            md_warnings = validate_markdown(file_path)
            if md_warnings:
                print(f"⚠️  Markdown Recommendations for {file_path}:")
                for warning in md_warnings[:5]:
                    print(f"   • {warning}")
                if len(md_warnings) > 5:
                    print(f"   ... and {len(md_warnings) - 5} more warnings")
        
        # YAML validation (config files, docker-compose, frontmatter)
        elif file_path.endswith(('.yaml', '.yml')):
            yaml_warnings = validate_yaml(file_path)
            if yaml_warnings:
                print(f"⚠️  YAML Recommendations for {file_path}:")
                for warning in yaml_warnings[:5]:
                    print(f"   • {warning}")
                if len(yaml_warnings) > 5:
                    print(f"   ... and {len(yaml_warnings) - 5} more warnings")
        
        # For critical TypeScript files, run type check
        critical_files = ['src/types/', 'src/server/', 'src/tools/']
        if any(critical in file_path for critical in critical_files):
            if file_path.endswith(('.ts', '.tsx')):
                print("🔍 Running TypeScript validation for critical file...")
                ts_success, ts_message = run_type_check()
                if not ts_success:
                    print(f"⚠️  {ts_message}")
                else:
                    print(ts_message)
            elif file_path.endswith(('.js', '.jsx', '.mjs')):
                print("🔍 JavaScript file in critical directory - consider converting to TypeScript")
        
        sys.exit(0)
    
    except Exception as e:
        print(f"Error in auto-format hook: {e}", file=sys.stderr)
        sys.exit(1)  # Non-blocking error

if __name__ == "__main__":
    main()