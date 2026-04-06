#!/bin/bash

# StaffForge Workers API Test Script

BASE_URL="http://localhost:8787"

echo "=========================================="
echo "StaffForge Workers API Test"
echo "=========================================="
echo ""

# Test Health
echo "1. Testing Health Check..."
curl -s "$BASE_URL/api/health" | jq .
echo ""

# Test Get Roles
echo "2. Testing Get Roles..."
curl -s "$BASE_URL/api/roles" | jq '.data | length'
echo ""

# Test Get Featured Roles
echo "3. Testing Get Featured Roles..."
curl -s "$BASE_URL/api/roles/featured" | jq '.data | length'
echo ""

# Test Get Categories
echo "4. Testing Get Categories..."
curl -s "$BASE_URL/api/roles/categories" | jq .
echo ""

# Test Get Single Role
echo "5. Testing Get Single Role..."
curl -s "$BASE_URL/api/roles/beauty-influencer" | jq '.data.name'
echo ""

# Test Search Roles
echo "6. Testing Search Roles..."
curl -s "$BASE_URL/api/roles/search?q=fitness" | jq '.data | length'
echo ""

# Test Generate Role Config
echo "7. Testing Generate Role Config..."
curl -s -X POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "content",
    "description": "I need help creating social media content for beauty products",
    "level": "intermediate",
    "style": "professional",
    "language": "en"
  }' | jq '.data.name'
echo ""

# Test Usage Status (Anonymous)
echo "8. Testing Usage Status (Anonymous)..."
curl -s "$BASE_URL/api/usage/status" \
  -H "X-Device-Fingerprint: test-device-123" | jq '.remaining'
echo ""

# Test Get Plans
echo "9. Testing Get Plans..."
curl -s "$BASE_URL/api/payment/plans" | jq '.data | keys'
echo ""

echo "=========================================="
echo "Basic API Tests Complete!"
echo "=========================================="
