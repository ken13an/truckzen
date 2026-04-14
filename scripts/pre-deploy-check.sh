#!/usr/bin/env bash
# TruckZen pre-deploy regression gate (Patch 126).
# FAIL CLOSED: any failure stops deploy. Do not bypass with --no-verify or similar.
set -e

echo "=== TruckZen Pre-Deploy Verification ==="
echo ""

echo "1/4  Critical regression gate (Patches 122/123/124/125 hot zones)..."
npm run regression:critical
echo ""

echo "2/4  Running full test suite..."
npm run test
echo ""

echo "3/4  Running TypeScript type check..."
npm run typecheck
echo ""

echo "4/4  Running production build..."
npm run build
echo ""

echo "=== All checks passed — safe to deploy ==="
