#!/bin/bash
# Build script for Flow Desk NAPI module

set -e

echo "🔧 Building Flow Desk Shared Rust Library..."

# Set environment variables for proper NAPI linking
export NODE_API_NO_EXTERNAL_BUFFERS=true
export MACOSX_DEPLOYMENT_TARGET=11.0

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cargo clean

# Build with proper NAPI configuration
echo "🔨 Building Rust library..."
cargo build --release --features napi

# Build the NAPI module
echo "📦 Building NAPI module..."
npx napi build --platform --release

echo "✅ Build completed successfully!"

# Test the module
if [ -f "flow-desk-shared.darwin-arm64.node" ]; then
    echo "🧪 Testing module loading..."
    node -e "
        try {
            const lib = require('./flow-desk-shared.darwin-arm64.node');
            console.log('✅ Module loaded successfully!');
            console.log('Available functions:', Object.keys(lib));
            if (typeof lib.hello === 'function') {
                console.log('✅ Hello function works:', lib.hello());
            }
        } catch (e) {
            console.error('❌ Module test failed:', e.message);
            process.exit(1);
        }
    "
else
    echo "❌ NAPI module file not found"
    exit 1
fi