#!/usr/bin/env bash
set -e

echo "=== TruckZen Pre-Deploy Verification ==="
echo ""

echo "1/3  Running test suite..."
npm run test
echo ""

echo "2/3  Running TypeScript type check..."
npm run typecheck
echo ""

echo "3/3  Running production build..."
npm run build
echo ""

echo "=== All checks passed ==="
