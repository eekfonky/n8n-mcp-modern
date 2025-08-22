#!/bin/bash
set -e
file_path=$(jq -r '.tool_input.file_path' <&0)

if [[ "$file_path" == *.js ]]; then
  claude send --silent --agent javascript-validator "PROACTIVELY validate the recent changes in: $file_path"
fi
exit 0
