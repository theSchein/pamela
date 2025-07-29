#!/bin/bash

# Comprehensive Trading Test Runner
# Runs all polymarket trading tests in organized sequence

set -e

echo "🚀 Starting Polymarket Trading Test Suite"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="plugin-polymarket/__tests__"
LIVE_TESTING=${LIVE_TESTING:-false}
TEST_TIMEOUT=${TEST_TIMEOUT:-30000}
SMALL_ORDER_SIZE=${TEST_ORDER_SIZE:-1}

echo -e "${BLUE}Configuration:${NC}"
echo "  Live Testing: $LIVE_TESTING"
echo "  Test Timeout: ${TEST_TIMEOUT}ms"
echo "  Small Order Size: \$${SMALL_ORDER_SIZE}"
echo ""

# Check requirements
echo -e "${BLUE}Checking requirements...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file with required settings"
    exit 1
fi

# Check for required environment variables
if [ -z "$POLYMARKET_PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  POLYMARKET_PRIVATE_KEY not set - some tests will be skipped${NC}"
fi

if [ -z "$CLOB_API_URL" ]; then
    echo -e "${YELLOW}⚠️  CLOB_API_URL not set - using default${NC}"
    export CLOB_API_URL="https://clob.polymarket.com/"
fi

echo -e "${GREEN}✅ Requirements check completed${NC}"
echo ""

# Function to run test with proper error handling
run_test() {
    local test_file=$1
    local test_name=$2
    
    echo -e "${BLUE}Running: $test_name${NC}"
    echo "----------------------------------------"
    
    if [ -f "$test_file" ]; then
        if npm run test -- "$test_file" --reporter=verbose; then
            echo -e "${GREEN}✅ $test_name passed${NC}"
        else
            echo -e "${RED}❌ $test_name failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Test file not found: $test_file${NC}"
        return 1
    fi
    
    echo ""
}

# Function to run ElizaOS CLI tests
run_elizaos_test() {
    local test_type=$1
    local test_name=$2
    
    echo -e "${BLUE}Running ElizaOS $test_type test: $test_name${NC}"
    echo "----------------------------------------"
    
    if elizaos test --type "$test_type" --skip-type-check --name "$test_name"; then
        echo -e "${GREEN}✅ ElizaOS $test_type test passed${NC}"
    else
        echo -e "${RED}❌ ElizaOS $test_type test failed${NC}"
        return 1
    fi
    
    echo ""
}

# Test execution sequence
test_failures=0

echo -e "${BLUE}Phase 1: Unit Tests${NC}"
echo "=================="

# Run basic action validation tests
if ! run_test "$TEST_DIR/trading-actions.test.ts" "Trading Actions Validation"; then
    ((test_failures++))
fi

# Run sell/redeem preparation tests
if ! run_test "$TEST_DIR/sell-redeem-actions.test.ts" "Sell/Redeem Actions Preparation"; then
    ((test_failures++))
fi

echo -e "${BLUE}Phase 2: Integration Tests${NC}"
echo "=========================="

# Run ElizaOS component tests
if ! run_elizaos_test "component" "*polymarket*"; then
    ((test_failures++))
fi

# Run ElizaOS e2e tests  
if ! run_elizaos_test "e2e" "*trading*"; then
    ((test_failures++))
fi

echo -e "${BLUE}Phase 3: Market Data Tests${NC}"
echo "=========================="

# Test market retrieval
echo -e "${BLUE}Testing market data retrieval...${NC}"
if npm run test -- "$TEST_DIR/trading-actions.test.ts" --grep "Market Discovery"; then
    echo -e "${GREEN}✅ Market data tests passed${NC}"
else
    echo -e "${RED}❌ Market data tests failed${NC}"
    ((test_failures++))
fi

echo ""

# Phase 4: Live Testing (only if enabled)
if [ "$LIVE_TESTING" = "true" ]; then
    echo -e "${RED}Phase 4: LIVE TESTING (REAL MONEY)${NC}"
    echo -e "${RED}===================================${NC}"
    echo -e "${YELLOW}⚠️  WARNING: These tests use real funds!${NC}"
    echo -e "${YELLOW}⚠️  Maximum order size: \$${SMALL_ORDER_SIZE}${NC}"
    
    read -p "Continue with live testing? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}🚨 Starting live tests with real money...${NC}"
        
        if ! run_test "$TEST_DIR/integration-live.test.ts" "Live Trading Integration"; then
            ((test_failures++))
        fi
    else
        echo -e "${YELLOW}⚠️  Live testing skipped by user${NC}"
    fi
else
    echo -e "${BLUE}Phase 4: Live Testing${NC}"
    echo "===================="
    echo -e "${YELLOW}⚠️  Live testing disabled (set LIVE_TESTING=true to enable)${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}Test Summary${NC}"
echo "============"

if [ $test_failures -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed successfully!${NC}"
    echo ""
    echo -e "${GREEN}✅ Trading functionality verified${NC}"
    echo -e "${GREEN}✅ Error handling tested${NC}"
    echo -e "${GREEN}✅ Integration workflows working${NC}"
    
    if [ "$LIVE_TESTING" = "true" ]; then
        echo -e "${GREEN}✅ Live trading tested with real funds${NC}"
        echo -e "${YELLOW}💡 Remember to check your Polymarket positions${NC}"
    fi
    
    exit 0
else
    echo -e "${RED}❌ $test_failures test(s) failed${NC}"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "  - Missing environment variables"
    echo "  - Network connectivity problems"
    echo "  - Insufficient wallet balance"
    echo "  - API rate limiting"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Check your .env configuration"
    echo "  2. Verify wallet has USDC balance"
    echo "  3. Check network connectivity"
    echo "  4. Re-run individual failed tests"
    
    exit 1
fi