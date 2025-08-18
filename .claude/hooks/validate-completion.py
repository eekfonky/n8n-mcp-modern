#!/usr/bin/env python3
"""
Completion validation hook for n8n-MCP Modern project.
Ensures tasks are properly completed and validates final state.
"""
import json
import sys
import os
import subprocess
import re

def check_typescript_compilation():
    """Check if TypeScript compiles without errors."""
    try:
        result = subprocess.run(
            ['npm', 'run', 'typecheck'],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode == 0:
            return True, "✅ TypeScript compilation successful"
        else:
            errors = result.stdout + result.stderr
            error_count = len(re.findall(r'error TS\d+:', errors))
            return False, f"❌ {error_count} TypeScript errors found"
    except Exception as e:
        return False, f"❌ TypeScript check failed: {e}"

def check_test_status():
    """Check if tests are passing."""
    try:
        result = subprocess.run(
            ['npm', 'test', '--run', '--reporter=json'],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        # Parse test results
        try:
            # Vitest may output non-JSON content, find the JSON part
            output_lines = result.stdout.split('\n')
            json_line = None
            for line in reversed(output_lines):
                if line.strip().startswith('{') and 'testResults' in line:
                    json_line = line
                    break
            
            if json_line:
                test_data = json.loads(json_line)
                total = test_data.get('numTotalTests', 0)
                passed = test_data.get('numPassedTests', 0)
                failed = test_data.get('numFailedTests', 0)
                
                if failed == 0 and total > 0:
                    return True, f"✅ All {total} tests passing"
                else:
                    return False, f"❌ {failed}/{total} tests failing"
            else:
                # Fallback to exit code
                if result.returncode == 0:
                    return True, "✅ Tests appear to be passing"
                else:
                    return False, "❌ Some tests are failing"
        
        except json.JSONDecodeError:
            # Fallback to exit code
            if result.returncode == 0:
                return True, "✅ Tests completed successfully"
            else:
                return False, "❌ Tests failed"
    
    except Exception as e:
        return False, f"❌ Test execution failed: {e}"

def check_linting():
    """Check if linting passes."""
    try:
        result = subprocess.run(
            ['npm', 'run', 'lint'],
            capture_output=True,
            text=True,
            timeout=60,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode == 0:
            return True, "✅ Linting passed"
        else:
            return False, f"❌ Linting issues found"
    except Exception as e:
        return False, f"❌ Linting check failed: {e}"

def check_build_status():
    """Check if project builds successfully."""
    try:
        result = subprocess.run(
            ['npm', 'run', 'build'],
            capture_output=True,
            text=True,
            timeout=120,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode == 0:
            # Check if dist directory exists with expected files
            dist_path = os.path.join(os.environ.get('CLAUDE_PROJECT_DIR', '.'), 'dist')
            if os.path.exists(os.path.join(dist_path, 'index.js')):
                return True, "✅ Build successful with executable"
            else:
                return False, "❌ Build completed but missing expected files"
        else:
            return False, f"❌ Build failed"
    except Exception as e:
        return False, f"❌ Build check failed: {e}"

def check_agent_consistency():
    """Check if agents are properly configured."""
    try:
        agents_dir = os.path.join(os.environ.get('CLAUDE_PROJECT_DIR', '.'), '.claude/agents')
        if not os.path.exists(agents_dir):
            return False, "❌ Agent directory missing"
        
        expected_agents = [
            'n8n-workflow-architect.md',
            'n8n-developer-specialist.md',
            'n8n-integration-specialist.md',
            'n8n-node-specialist.md',
            'n8n-performance-specialist.md',
            'n8n-guidance-specialist.md'
        ]
        
        missing_agents = []
        for agent in expected_agents:
            agent_path = os.path.join(agents_dir, agent)
            if not os.path.exists(agent_path):
                missing_agents.append(agent)
        
        if missing_agents:
            return False, f"❌ Missing agents: {', '.join(missing_agents)}"
        
        return True, f"✅ All {len(expected_agents)} agents configured"
    
    except Exception as e:
        return False, f"❌ Agent check failed: {e}"

def analyze_recent_changes():
    """Analyze recent changes for potential issues."""
    try:
        # Get recent git changes
        result = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD~1..HEAD'],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=os.environ.get('CLAUDE_PROJECT_DIR', '.')
        )
        
        if result.returncode != 0:
            return True, "No recent changes detected"
        
        changed_files = result.stdout.strip().split('\n')
        changed_files = [f for f in changed_files if f.strip()]
        
        if not changed_files:
            return True, "No recent changes detected"
        
        critical_changes = [f for f in changed_files if any(pattern in f for pattern in [
            'package.json', 'tsconfig.json', 'src/types/', 'src/server/', '.claude/'
        ])]
        
        if critical_changes:
            return True, f"ℹ️  Recent critical changes: {', '.join(critical_changes)}"
        
        return True, f"ℹ️  Recent changes: {len(changed_files)} files modified"
    
    except Exception as e:
        return True, f"ℹ️  Cannot analyze changes: {e}"

def main():
    try:
        input_data = json.load(sys.stdin)
        hook_event_name = input_data.get("hook_event_name", "")
        
        if hook_event_name not in ["Stop", "SubagentStop"]:
            sys.exit(0)  # Not a completion event
        
        print("🔍 **Validating Project State**")
        
        # Run validation checks
        checks = [
            ("TypeScript", check_typescript_compilation),
            ("Tests", check_test_status), 
            ("Linting", check_linting),
            ("Build", check_build_status),
            ("Agents", check_agent_consistency),
        ]
        
        all_passed = True
        results = []
        
        for check_name, check_func in checks:
            try:
                passed, message = check_func()
                results.append(f"   {message}")
                if not passed:
                    all_passed = False
            except Exception as e:
                results.append(f"   ⚠️  {check_name} check error: {e}")
        
        # Show results
        for result in results:
            print(result)
        
        # Analyze recent changes
        _, change_info = analyze_recent_changes()
        print(f"   {change_info}")
        
        # Overall status
        if all_passed:
            print("\n✅ **Project validation completed successfully**")
        else:
            print("\n⚠️  **Some validation checks failed - consider addressing before completion**")
            
            # For Stop events, suggest continuing to fix issues
            if hook_event_name == "Stop":
                print("\n**Suggested Actions:**", file=sys.stderr)
                print("- Run 'npm run typecheck' to fix TypeScript issues", file=sys.stderr)
                print("- Run 'npm test' to ensure all tests pass", file=sys.stderr) 
                print("- Run 'npm run lint' to fix code style issues", file=sys.stderr)
                print("- Verify all agent files are properly configured", file=sys.stderr)
                
                # Block stopping to allow fixes
                sys.exit(2)
        
        sys.exit(0)
    
    except Exception as e:
        print(f"Error in completion validation: {e}", file=sys.stderr)
        sys.exit(1)  # Non-blocking error

if __name__ == "__main__":
    main()