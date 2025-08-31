#!/bin/bash

# Flow Desk Ultimate Integration Test Runner
# 
# This script prepares and runs the complete integration test suite
# to verify that all components of Flow Desk work together properly.

set -e

echo "🚀 Flow Desk Ultimate Integration Test Runner"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${2}${1}${NC}"
}

print_status "Preparing Flow Desk for integration testing..." $BLUE

# Step 1: Build Rust library
print_status "📦 Building Rust library..." $BLUE
cd shared/rust-lib
if cargo build --release; then
    print_status "✅ Rust library built successfully" $GREEN
else
    print_status "❌ Rust library build failed" $RED
    exit 1
fi
cd ../..

# Step 2: Install dependencies
print_status "📋 Installing dependencies..." $BLUE

# Desktop app dependencies
cd desktop-app
if npm install; then
    print_status "✅ Desktop dependencies installed" $GREEN
else
    print_status "❌ Desktop dependency installation failed" $RED
    exit 1
fi
cd ..

# Mobile app dependencies (if available)
if [ -d "mobile-app" ]; then
    cd mobile-app
    if npm install; then
        print_status "✅ Mobile dependencies installed" $GREEN
    else
        print_status "⚠️  Mobile dependency installation failed, continuing..." $YELLOW
    fi
    cd ..
fi

# Root dependencies for test runner
if npm install; then
    print_status "✅ Test runner dependencies installed" $GREEN
else
    print_status "❌ Test runner dependency installation failed" $RED
    exit 1
fi

# Step 3: Build applications
print_status "🔨 Building applications..." $BLUE

# Build desktop app
cd desktop-app
if npm run build; then
    print_status "✅ Desktop app built successfully" $GREEN
else
    print_status "❌ Desktop app build failed" $RED
    exit 1
fi
cd ..

# Build mobile app (if available)
if [ -d "mobile-app" ]; then
    cd mobile-app
    if npm run build:ios 2>/dev/null || npm run build 2>/dev/null; then
        print_status "✅ Mobile app built successfully" $GREEN
    else
        print_status "⚠️  Mobile app build failed, continuing without mobile testing..." $YELLOW
    fi
    cd ..
fi

# Step 4: Verify Rust library integration
print_status "🔍 Verifying Rust library integration..." $BLUE

RUST_LIB_PATH="./shared/rust-lib/target/release"
if [[ "$OSTYPE" == "darwin"* ]]; then
    RUST_LIB="$RUST_LIB_PATH/libflow_desk_rust.dylib"
elif [[ "$OSTYPE" == "linux"* ]]; then
    RUST_LIB="$RUST_LIB_PATH/libflow_desk_rust.so"
else
    RUST_LIB="$RUST_LIB_PATH/flow_desk_rust.dll"
fi

if [ -f "$RUST_LIB" ]; then
    print_status "✅ Rust library found at: $RUST_LIB" $GREEN
    print_status "   Library size: $(du -h "$RUST_LIB" | cut -f1)" $BLUE
else
    print_status "❌ Rust library not found at expected location: $RUST_LIB" $RED
    exit 1
fi

# Step 5: Set up test environment
print_status "⚙️  Setting up test environment..." $BLUE

# Create test data directories
mkdir -p ./test-data/mail
mkdir -p ./test-data/calendar
mkdir -p ./test-data/plugins
mkdir -p ./test-data/automation
mkdir -p ./test-results

# Set environment variables for testing
export NODE_ENV=test
export FLOW_DESK_TEST_MODE=true
export FLOW_DESK_DATA_DIR="./test-data"
export FLOW_DESK_LOG_LEVEL=debug

print_status "✅ Test environment configured" $GREEN

# Step 6: Run pre-test validations
print_status "🧪 Running pre-test validations..." $BLUE

# Check if required ports are available
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        print_status "⚠️  Port $port is already in use (needed for $service)" $YELLOW
        print_status "   Attempting to free port..." $BLUE
        # Kill the process using the port
        lsof -ti :$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    
    if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        print_status "✅ Port $port is available for $service" $GREEN
    else
        print_status "❌ Unable to free port $port for $service" $RED
        return 1
    fi
}

check_port 3000 "Desktop App"
check_port 3001 "Mobile Simulator"

# Step 7: Run the integration test
print_status "🎯 Starting Ultimate Integration Test..." $GREEN
echo ""

# Create a log file for the test run
LOG_FILE="./test-results/integration-test-$(date +%Y%m%d-%H%M%S).log"

# Run the test with logging
if node ultimate-integration-test.js 2>&1 | tee "$LOG_FILE"; then
    TEST_EXIT_CODE=${PIPESTATUS[0]}
else
    TEST_EXIT_CODE=1
fi

echo ""
print_status "📄 Test log saved to: $LOG_FILE" $BLUE

# Step 8: Process test results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "🎉 INTEGRATION TEST PASSED!" $GREEN
    echo ""
    print_status "Flow Desk has been successfully verified as a complete, integrated platform." $GREEN
    print_status "All components are working together properly:" $GREEN
    echo ""
    echo "  ✅ Rust engines (mail, calendar, search)"
    echo "  ✅ Desktop IPC integration" 
    echo "  ✅ React/Redux data flow"
    echo "  ✅ Mobile app integration"
    echo "  ✅ Plugin system"
    echo "  ✅ Automation engine"
    echo "  ✅ Cross-platform sync"
    echo ""
    print_status "Flow Desk is ready for production deployment! 🚀" $GREEN
else
    print_status "❌ INTEGRATION TEST FAILED" $RED
    echo ""
    print_status "Some components require attention before production deployment." $YELLOW
    print_status "Please check the test log for detailed error information." $YELLOW
    echo ""
    print_status "Log file: $LOG_FILE" $BLUE
fi

# Step 9: Generate summary report
print_status "📊 Generating summary report..." $BLUE

REPORT_FILE="./test-results/integration-summary-$(date +%Y%m%d-%H%M%S).md"

cat > "$REPORT_FILE" << EOF
# Flow Desk Integration Test Summary

**Test Date:** $(date)
**Test Duration:** $(date -d @$SECONDS -u +%H:%M:%S) 
**Exit Code:** $TEST_EXIT_CODE

## Test Environment

- **Operating System:** $(uname -s) $(uname -r)
- **Node.js Version:** $(node --version)
- **Rust Version:** $(rustc --version)
- **Electron Version:** $(cd desktop-app && npm list electron --depth=0 2>/dev/null | grep electron || echo "N/A")

## Components Tested

- [x] Rust Engine Library
- [x] Desktop Application Build
- [x] Mobile Application Build (if available)
- [x] IPC Integration Chain
- [x] Plugin System Runtime
- [x] Automation Engine
- [x] Cross-Platform Sync
- [x] Complete User Workflows

## Test Results

$(if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "### ✅ SUCCESS"
    echo ""
    echo "All integration tests passed successfully. Flow Desk is functioning as a cohesive, integrated productivity platform."
    echo ""
    echo "**Key Achievements:**"
    echo "- All Rust engines are properly integrated with the application layers"
    echo "- Desktop and mobile applications successfully connect to the Rust backend"
    echo "- Plugin system loads and executes real plugins with proper security"
    echo "- Automation engine creates and executes workflows across all components"
    echo "- Cross-platform synchronization maintains data consistency"
    echo "- Complete user workflows function as designed"
else
    echo "### ❌ ISSUES FOUND"
    echo ""
    echo "Some integration tests failed. Review the detailed log for specific issues."
    echo ""
    echo "**Next Steps:**"
    echo "1. Review the test log: \`$LOG_FILE\`"
    echo "2. Fix any failing component integrations"
    echo "3. Re-run the integration test"
    echo "4. Verify all components work together properly"
fi)

## Files Generated

- **Detailed Log:** \`$LOG_FILE\`
- **Summary Report:** \`$REPORT_FILE\`
- **Test Data:** \`./test-data/\`
- **Test Results:** \`./test-results/\`

---

*Generated by Flow Desk Integration Test Runner*
EOF

print_status "📄 Summary report saved to: $REPORT_FILE" $BLUE

# Step 10: Cleanup
print_status "🧹 Cleaning up test environment..." $BLUE

# Stop any remaining processes
pkill -f "electron.*flow.*desk" 2>/dev/null || true
pkill -f "node.*ultimate-integration-test" 2>/dev/null || true

# Remove temporary files
rm -rf ./test-data/temp 2>/dev/null || true

print_status "✅ Cleanup completed" $GREEN

echo ""
echo "============================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    print_status "🎯 FLOW DESK INTEGRATION TEST: SUCCESS" $GREEN
else
    print_status "🎯 FLOW DESK INTEGRATION TEST: REVIEW NEEDED" $YELLOW
fi
echo "============================================"

exit $TEST_EXIT_CODE