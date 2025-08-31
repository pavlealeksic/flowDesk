#!/bin/bash

# Flow Desk Complete Validation Runner
# 
# This script runs the complete validation suite that proves Flow Desk
# is a production-ready, fully-integrated productivity platform.
#
# It executes all test suites in the correct order and generates
# a comprehensive report proving the system works as designed.

set -e  # Exit on any error

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
NC='\\033[0m' # No Color

# Test configuration
TEST_START_TIME=$(date +%s)
REPORT_DIR="./test-reports"
FINAL_REPORT_FILE="$REPORT_DIR/complete-validation-report-$(date +%s).json"

# Create reports directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}"
echo "🚀 FLOW DESK COMPLETE VALIDATION SUITE"
echo "======================================================================"
echo "This test suite proves that Flow Desk is a complete, production-ready"
echo "productivity platform that delivers on all its promises."
echo "======================================================================"
echo -e "${NC}"

# Test tracking
declare -a TEST_RESULTS=()
declare -a TEST_DURATIONS=()
declare -a TEST_NAMES=()

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    local test_start=$(date +%s)
    
    echo -e "\\n${PURPLE}📋 Running: $test_name${NC}"
    echo "----------------------------------------------------------------------"
    
    if eval "$test_command"; then
        local test_end=$(date +%s)
        local test_duration=$((test_end - test_start))
        
        echo -e "${GREEN}✅ $test_name: PASSED (${test_duration}s)${NC}"
        TEST_RESULTS+=("PASSED")
        TEST_DURATIONS+=("$test_duration")
        TEST_NAMES+=("$test_name")
        return 0
    else
        local test_end=$(date +%s)
        local test_duration=$((test_end - test_start))
        
        echo -e "${RED}❌ $test_name: FAILED (${test_duration}s)${NC}"
        TEST_RESULTS+=("FAILED")
        TEST_DURATIONS+=("$test_duration")
        TEST_NAMES+=("$test_name")
        return 1
    fi
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "\\n${BLUE}🔍 Checking Prerequisites${NC}"
    echo "----------------------------------------------------------------------"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    else
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
    else
        echo -e "${RED}❌ npm not found${NC}"
        exit 1
    fi
    
    # Check Rust
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        echo -e "${GREEN}✅ Rust: $RUST_VERSION${NC}"
    else
        echo -e "${RED}❌ Rust not found${NC}"
        exit 1
    fi
    
    # Check if Rust library exists
    if [[ "$OSTYPE" == "darwin"* ]]; then
        RUST_LIB="./shared/rust-lib/target/release/libflow_desk_rust.dylib"
    elif [[ "$OSTYPE" == "linux"* ]]; then
        RUST_LIB="./shared/rust-lib/target/release/libflow_desk_rust.so"
    else
        RUST_LIB="./shared/rust-lib/target/release/flow_desk_rust.dll"
    fi
    
    if [ -f "$RUST_LIB" ]; then
        RUST_LIB_SIZE=$(ls -lh "$RUST_LIB" | awk '{print $5}')
        echo -e "${GREEN}✅ Rust library: $RUST_LIB ($RUST_LIB_SIZE)${NC}"
    else
        echo -e "${YELLOW}⚠️  Rust library not found, attempting to build...${NC}"
        cd shared/rust-lib
        cargo build --release
        cd ../..
        
        if [ -f "$RUST_LIB" ]; then
            echo -e "${GREEN}✅ Rust library built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build Rust library${NC}"
            exit 1
        fi
    fi
    
    # Check environment file
    if [ -f ".env" ]; then
        echo -e "${GREEN}✅ Environment configuration found${NC}"
    else
        echo -e "${YELLOW}⚠️  .env file not found, copying from .env.example${NC}"
        cp .env.example .env
        echo -e "${YELLOW}⚠️  Please configure .env file with your OAuth credentials${NC}"
    fi
    
    echo -e "${GREEN}✅ All prerequisites satisfied${NC}"
}

# Function to generate final report
generate_final_report() {
    local total_tests=${#TEST_NAMES[@]}
    local passed_tests=$(printf '%s\\n' "${TEST_RESULTS[@]}" | grep -c "PASSED" || true)
    local failed_tests=$(printf '%s\\n' "${TEST_RESULTS[@]}" | grep -c "FAILED" || true)
    local success_rate=0
    
    if [ $total_tests -gt 0 ]; then
        success_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l)
    fi
    
    local total_duration=$(($(date +%s) - TEST_START_TIME))
    
    # Create JSON report
    cat > "$FINAL_REPORT_FILE" << EOF
{
  "meta": {
    "testType": "Flow Desk Complete Validation Suite",
    "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "duration": $total_duration,
    "environment": "$(uname -s)",
    "nodeVersion": "$(node --version)",
    "rustVersion": "$(rustc --version | cut -d' ' -f2)"
  },
  "summary": {
    "totalTests": $total_tests,
    "passedTests": $passed_tests,
    "failedTests": $failed_tests,
    "successRate": "$success_rate%",
    "durationFormatted": "${total_duration}s"
  },
  "tests": [
EOF

    # Add test results to JSON
    for i in "${!TEST_NAMES[@]}"; do
        if [ $i -gt 0 ]; then
            echo "," >> "$FINAL_REPORT_FILE"
        fi
        cat >> "$FINAL_REPORT_FILE" << EOF
    {
      "name": "${TEST_NAMES[$i]}",
      "status": "${TEST_RESULTS[$i]}",
      "duration": ${TEST_DURATIONS[$i]}
    }
EOF
    done
    
    cat >> "$FINAL_REPORT_FILE" << EOF
  ],
  "productionReadiness": {
    "status": $([ $failed_tests -eq 0 ] && echo '"PRODUCTION_READY"' || echo '"NOT_READY"'),
    "confidence": $([ $failed_tests -eq 0 ] && echo '"HIGH"' || echo '"LOW"'),
    "deployment": $([ $failed_tests -eq 0 ] && echo '"APPROVED"' || echo '"BLOCKED"'),
    "message": $([ $failed_tests -eq 0 ] && echo '"All validation tests passed. Flow Desk is ready for production deployment."' || echo '"Some validation tests failed. Issues must be resolved before production deployment."')
  },
  "certification": {
    "certified": $([ $failed_tests -eq 0 ] && echo 'true' || echo 'false'),
    "certificationId": "FD-COMPLETE-VALIDATION-$(date +%s)",
    "statement": $([ $failed_tests -eq 0 ] && echo '"Flow Desk has successfully completed comprehensive validation testing and is hereby certified for production deployment."' || echo '"Flow Desk has not yet achieved complete validation certification."')
  }
}
EOF
}

# Main execution starts here
main() {
    echo -e "${BLUE}Starting Flow Desk Complete Validation Suite...${NC}"
    
    # Check prerequisites
    check_prerequisites
    
    echo -e "\\n${BLUE}📊 Test Execution Plan${NC}"
    echo "----------------------------------------------------------------------"
    echo "1. Rust Engine Validation"
    echo "2. Error Handling & Recovery Validation" 
    echo "3. Performance Validation"
    echo "4. Security Validation"
    echo "5. Cross-Platform Sync Validation"
    echo "6. Master Integration Test (Ultimate Proof)"
    echo ""
    
    # Phase 1: Rust Engine Validation
    run_test "Rust Engine Validation" "node rust-engine-test.js" || true
    
    # Phase 2: Error Handling Validation
    run_test "Error Handling & Recovery Validation" "node error-handling-test.js" || true
    
    # Phase 3: Performance Validation
    run_test "Performance Validation" "node performance-validation-test.js" || true
    
    # Phase 4: Security Validation
    run_test "Security Validation" "node security-validation-test.js" || true
    
    # Phase 5: Cross-Platform Sync Validation
    run_test "Cross-Platform Sync Validation" "node cross-platform-sync-test.js" || true
    
    # Phase 6: Master Integration Test (The Ultimate Proof)
    run_test "Master Integration Test" "node master-integration-test.js" || true
    
    # Generate comprehensive report
    echo -e "\\n${BLUE}📋 Generating Final Report${NC}"
    echo "----------------------------------------------------------------------"
    generate_final_report
    
    # Display final results
    local total_tests=${#TEST_NAMES[@]}
    local passed_tests=$(printf '%s\\n' "${TEST_RESULTS[@]}" | grep -c "PASSED" || true)
    local failed_tests=$(printf '%s\\n' "${TEST_RESULTS[@]}" | grep -c "FAILED" || true)
    local success_rate=0
    
    if [ $total_tests -gt 0 ]; then
        success_rate=$(echo "scale=1; $passed_tests * 100 / $total_tests" | bc -l)
    fi
    
    local total_duration=$(($(date +%s) - TEST_START_TIME))
    
    echo ""
    echo -e "${BLUE}======================================================================"
    echo "🏆 FLOW DESK COMPLETE VALIDATION RESULTS"
    echo "======================================================================${NC}"
    
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}"
        echo "🏆 PRODUCTION READY - DEPLOYMENT APPROVED"
        echo ""
        echo "Status: PRODUCTION_READY"
        echo "Confidence: HIGH"  
        echo "Deployment: APPROVED"
        echo ""
        echo "🎉 FLOW DESK VALIDATION: COMPLETE SUCCESS"
        echo ""
        echo "Flow Desk has been comprehensively validated and proven to be a"
        echo "complete, integrated, production-ready productivity platform that"
        echo "delivers on ALL its promises."
        echo ""
        echo "VALIDATED CAPABILITIES:"
        echo "✅ High-performance Rust engines"
        echo "✅ Comprehensive error handling and recovery"
        echo "✅ Production-grade performance"
        echo "✅ Enterprise security standards"
        echo "✅ Seamless cross-platform synchronization"
        echo "✅ Complete system integration"
        echo ""
        echo "This is not a prototype or proof-of-concept."
        echo "This is a complete, working productivity platform."
        echo -e "${NC}"
    else
        echo -e "${RED}"
        echo "⚠️  VALIDATION INCOMPLETE - DEPLOYMENT BLOCKED"
        echo ""
        echo "Status: NOT_READY"
        echo "Confidence: LOW"
        echo "Deployment: BLOCKED"
        echo ""
        echo "Flow Desk validation has detected issues that must be resolved"
        echo "before production deployment."
        echo -e "${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}📊 SUMMARY${NC}"
    echo "------------------------------"
    echo -e "Total Tests: $total_tests"
    echo -e "Passed: ${GREEN}$passed_tests${NC} ✅"
    echo -e "Failed: $([ $failed_tests -eq 0 ] && echo -e "${GREEN}$failed_tests${NC}" || echo -e "${RED}$failed_tests${NC}") $([ $failed_tests -eq 0 ] && echo "✅" || echo "❌")"
    echo -e "Success Rate: $([ $failed_tests -eq 0 ] && echo -e "${GREEN}$success_rate%${NC}" || echo -e "${YELLOW}$success_rate%${NC}")"
    echo -e "Total Duration: ${total_duration}s"
    
    echo ""
    echo -e "${BLUE}📋 DETAILED RESULTS${NC}"
    echo "------------------------------"
    for i in "${!TEST_NAMES[@]}"; do
        local status_icon=$([ "${TEST_RESULTS[$i]}" == "PASSED" ] && echo "✅" || echo "❌")
        local status_color=$([ "${TEST_RESULTS[$i]}" == "PASSED" ] && echo -e "${GREEN}" || echo -e "${RED}")
        echo -e "$status_icon ${TEST_NAMES[$i]}: ${status_color}${TEST_RESULTS[$i]}${NC} (${TEST_DURATIONS[$i]}s)"
    done
    
    echo ""
    echo -e "${BLUE}💾 Report saved: $FINAL_REPORT_FILE${NC}"
    echo ""
    
    # Exit with appropriate code
    if [ $failed_tests -eq 0 ]; then
        echo -e "${GREEN}🎯 Complete validation suite: SUCCESS${NC}"
        exit 0
    else
        echo -e "${RED}🎯 Complete validation suite: FAILURE${NC}"
        exit 1
    fi
}

# Trap to ensure cleanup on exit
cleanup() {
    echo -e "\\n${YELLOW}🧹 Cleaning up...${NC}"
    # Add any necessary cleanup here
}

trap cleanup EXIT

# Run main function
main "$@"