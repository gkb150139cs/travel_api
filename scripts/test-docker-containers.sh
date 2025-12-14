#!/bin/bash

# Script to run tests against Docker containers
# This script starts Docker containers and runs tests against them

set -e

echo "🐳 Configuring tests to run against Docker containers..."

# Check if Docker containers are running
if ! docker compose ps | grep -q "mongo.*Up"; then
    echo "⚠️  Docker containers are not running. Starting them..."
    docker compose up -d mongo redis
    echo "⏳ Waiting for MongoDB to be ready..."
    sleep 5
fi

# Export environment variables for Docker container endpoints
export USE_DOCKER=true
export MONGODB_URI_TEST=mongodb://localhost:27019/tmtc-test
export REDIS_URL=redis://localhost:6381
export NODE_ENV=test
export JWT_SECRET=test-secret-key
export EMAIL_ENABLED=false

echo "📋 Test Configuration:"
echo "   USE_DOCKER=true"
echo "   MONGODB_URI_TEST=${MONGODB_URI_TEST}"
echo "   REDIS_URL=${REDIS_URL}"
echo ""

# Run tests
echo "🧪 Running tests against Docker containers..."
npm test

echo "✅ Tests completed!"

