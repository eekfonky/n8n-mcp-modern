#!/bin/bash
set -e

# Read the JSON input from stdin
json_input=$(cat)

# Extract the file path from the JSON
file_path=$(echo "$json_input" | jq -r '.tool_input.file_path')

# Check if it's a JavaScript file
if [[ "$file_path" == *.js || "$file_path" == *.jsx || "$file_path" == *.mjs || "$file_path" == *.cjs ]]; then
  echo "JavaScript file written: $file_path. Running validation and fixes..." >&2
  
  # Call Claude in headless mode to validate and fix the JavaScript file
  claude -p "Please validate the JavaScript file at $file_path. Check for:
1. Syntax errors
2. ESLint issues (if .eslintrc is present, run eslint)
3. Common JavaScript mistakes (undefined variables, missing semicolons if required by style)
4. Potential runtime errors
5. Best practices violations

If you find any issues, fix them directly in the file. Make sure the file has no syntax errors.
Only make changes if there are actual JavaScript errors or quality issues."
  
  # Check if the fixes were successful
  if [ $? -eq 0 ]; then
    echo "JavaScript validation and fixes completed for $file_path" >&2
    exit 0
  else
    echo "Failed to validate/fix JavaScript in $file_path" >&2
    exit 1  # Non-blocking error
  fi
fi

exit 0
