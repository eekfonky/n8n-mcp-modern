#!/bin/bash
set -e
file_path=$(jq -r '.tool_input.file_path' <&0)

if [[ "$file_path" == *.ts || "$file_path" == *.tsx ]]; then
  claude send --silent --agent typescript-validator "PROACTIVELY validate the recent changes in: $file_path"
fi
exit 0
