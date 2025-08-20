#!/bin/sh
# Pre-push hook to validate README.md before pushing
# To install: cp scripts/pre-push-hook.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push

echo "🔍 Running pre-push validation..."

# Run README validation
npm run validate-readme
if [ $? -ne 0 ]; then
    echo "❌ Pre-push validation failed. README.md needs to be updated."
    echo "💡 Run 'npm run validate-readme' to see what needs fixing."
    exit 1
fi

echo "✅ Pre-push validation passed!"
exit 0