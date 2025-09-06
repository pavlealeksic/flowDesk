#!/bin/bash

# Fix all service icon URLs to use local assets
FILE="/Users/pavlealeksic/Gits/nasi/flowDesk/desktop-app/src/renderer/components/workspace/AddServiceModal.tsx"

# Replace all remaining external favicon URLs with local paths
sed -i '' 's|https://www\.evernote\.com/favicon\.ico|/src/assets/service-icons/evernote.ico|g' "$FILE"
sed -i '' 's|https://www\.onenote\.com/favicon\.ico|/src/assets/service-icons/onenote.ico|g' "$FILE"
sed -i '' 's|https://www\.sketch\.com/favicon\.ico|/src/assets/service-icons/sketch.ico|g' "$FILE"
sed -i '' 's|https://www\.canva\.com/favicon\.ico|/src/assets/service-icons/canva.ico|g' "$FILE"
sed -i '' 's|https://www\.adobe\.com/favicon\.ico|/src/assets/service-icons/adobe.ico|g' "$FILE"
sed -i '' 's|https://outlook\.office\.com/favicon\.ico|/src/assets/service-icons/outlook.ico|g' "$FILE"
sed -i '' 's|https://analytics\.google\.com/favicon\.ico|/src/assets/service-icons/analytics.ico|g' "$FILE"
sed -i '' 's|https://mailchimp\.com/favicon\.ico|/src/assets/service-icons/mailchimp.ico|g' "$FILE"
sed -i '' 's|https://dashboard\.stripe\.com/favicon\.ico|/src/assets/service-icons/stripe.ico|g' "$FILE"
sed -i '' 's|https://quickbooks\.intuit\.com/favicon\.ico|/src/assets/service-icons/quickbooks.ico|g' "$FILE"
sed -i '' 's|https://twitter\.com/favicon\.ico|/src/assets/service-icons/twitter.ico|g' "$FILE"
sed -i '' 's|https://www\.linkedin\.com/favicon\.ico|/src/assets/service-icons/linkedin.ico|g' "$FILE"
sed -i '' 's|https://www\.instagram\.com/favicon\.ico|/src/assets/service-icons/instagram.ico|g' "$FILE"
sed -i '' 's|https://app\.intercom\.com/favicon\.ico|/src/assets/service-icons/intercom.png|g' "$FILE"

echo "✅ All external favicon URLs replaced with local paths"