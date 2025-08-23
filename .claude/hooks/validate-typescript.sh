#!/bin/bash
set -e

# Read the JSON input from stdin
json_input=$(cat)

# Extract the file path from the JSON
file_path=$(echo "$json_input" | jq -r '.tool_input.file_path')

# Check if it's a TypeScript file
if [[ "$file_path" == *.ts || "$file_path" == *.tsx ]]; then
  echo "TypeScript file written: $file_path. Running validation and fixes..." >&2
  
  # Call Claude in headless mode to validate and fix the TypeScript file
  claude -p "Please validate the TypeScript file at $file_path. Check for:
1. TypeScript compilation errors (run tsc --noEmit)
2. Type safety issues
3. Missing type annotations
4. Incorrect type usage

If you find any issues, fix them directly in the file. Make sure the file compiles without errors.
Only make changes if there are actual TypeScript errors or type issues."
  
  # Check if the fixes were successful
  if [ $? -eq 0 ]; then
    echo "TypeScript validation and fixes completed for $file_path" >&2
    exit 0
  else
    echo "Failed to validate/fix TypeScript in $file_path" >&2
    exit 1  # Non-blocking error
  fi
fi

exit 0
