#!/bin/bash

# GitHub Secrets Setup Script for careers-mt
# This script helps you set up required GitHub Actions secrets

set -e

echo "🚀 GitHub Secrets Setup for careers-mt"
echo "======================================"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install it with: brew install gh (macOS) or apt install gh (Ubuntu)"
    echo "Then run: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI."
    echo "Run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "Gbun420/careers-mt")
echo "📦 Repository: $REPO"
echo ""

# Function to add secret
add_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3
    
    if [ -z "$secret_value" ]; then
        echo "⚠️  Skipping $secret_name (no value provided)"
        return
    fi
    
    echo "🔐 Setting $secret_name..."
    echo "$secret_value" | gh secret set "$secret_name" -R "$REPO" -b-
    echo "✅ $secret_name set successfully"
    echo ""
}

# Vercel Secrets
echo "=== VERCEL DEPLOYMENT ==="
echo "Get these from: https://vercel.com/account/tokens"
echo ""

read -p "Enter Vercel Token: " VERCEL_TOKEN
add_secret "VERCEL_TOKEN" "$VERCEL_TOKEN" "Vercel deployment token"

# Vercel Project IDs
echo "Found in .vercel/project.json:"
echo "  projectId: prj_Ocf7cGyGBhmWC6mUZylBB7Y9JTlP"
echo "  orgId: team_wh7TcrBT8JzVV1wgqaZaExs2"
echo ""

read -p "Enter Vercel Org ID [team_wh7TcrBT8JzVV1wgqaZaExs2]: " VERCEL_ORG_ID
VERCEL_ORG_ID=${VERCEL_ORG_ID:-"team_wh7TcrBT8JzVV1wgqaZaExs2"}
add_secret "VERCEL_ORG_ID" "$VERCEL_ORG_ID" "Vercel organization ID"

read -p "Enter Vercel Project ID [prj_Ocf7cGyGBhmWC6mUZylBB7Y9JTlP]: " VERCEL_PROJECT_ID
VERCEL_PROJECT_ID=${VERCEL_PROJECT_ID:-"prj_Ocf7cGyGBhmWC6mUZylBB7Y9JTlP"}
add_secret "VERCEL_PROJECT_ID" "$VERCEL_PROJECT_ID" "Vercel project ID"

# Firebase Config
echo ""
echo "=== FIREBASE CONFIGURATION ==="
echo "Get from: https://console.firebase.google.com"
echo "Project settings → General → Your apps → Config"
echo ""

read -p "Enter NEXT_PUBLIC_FIREBASE_CONFIG (JSON string): " FIREBASE_CONFIG
add_secret "NEXT_PUBLIC_FIREBASE_CONFIG" "$FIREBASE_CONFIG" "Firebase client configuration"

# Stripe (Production)
echo ""
echo "=== STRIPE PAYMENTS ==="
echo "Get from: https://dashboard.stripe.com/apikeys"
echo ""

read -p "Enter Stripe Secret Key (sk_live_...): " STRIPE_SECRET_KEY
add_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "Stripe secret key"

read -p "Enter Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET
add_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET" "Stripe webhook secret"

# Email (Resend)
echo ""
echo "=== EMAIL SERVICE ==="
echo "Get from: https://resend.com/api-keys"
echo ""

read -p "Enter Resend API Key: " RESEND_API_KEY
add_secret "RESEND_API_KEY" "$RESEND_API_KEY" "Resend email API key"

# Optional Services
echo ""
echo "=== OPTIONAL SERVICES ==="

read -p "Enter Groq API Key (optional): " GROQ_API_KEY
add_secret "GROQ_API_KEY" "$GROQ_API_KEY" "Groq AI API key"

read -p "Enter reCAPTCHA Site Key (optional): " RECAPTCHA_SITE_KEY
add_secret "NEXT_PUBLIC_RECAPTCHA_SITE_KEY" "$RECAPTCHA_SITE_KEY" "reCAPTCHA site key"

echo ""
echo "✅ All secrets have been set!"
echo ""
echo "Next steps:"
echo "1. Commit and push the GitHub Actions workflow:"
echo "   git add .github/workflows/test.yml"
echo "   git commit -m \"Add CI/CD pipeline\""
echo "   git push origin main"
echo ""
echo "2. The workflow will run automatically on your next push/PR"
echo ""
echo "🔒 Security reminders:"
echo "   - Never commit .env files to git"
echo "   - Rotate any exposed keys immediately"
echo "   - Use test keys in development, live keys in production"