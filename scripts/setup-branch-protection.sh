#!/usr/bin/env bash
# setup-branch-protection.sh
#
# Configures branch protection rules for the main branch via GitHub CLI.
#
# Prerequisites:
#   - gh CLI installed and authenticated with repo admin access
#   - The CI workflow (.github/workflows/ci.yml) must be pushed and have run
#     at least once so the "CI" status check context is recognized by GitHub.
#
# This script is idempotent -- safe to re-run at any time.
# It will overwrite existing branch protection settings with the values below.
#
# Usage: ./scripts/setup-branch-protection.sh

set -euo pipefail

OWNER="syx-labs"
REPO="passive-docs-index"
BRANCH="main"

echo "Configuring branch protection for ${OWNER}/${REPO}@${BRANCH}..."
echo ""
echo "  - Required status check: CI (must pass before merge)"
echo "  - Require branch up-to-date before merge: yes"
echo "  - Enforce for admins: yes"
echo "  - Allow force pushes: no"
echo "  - Allow deletions: no"
echo "  - Require PR reviews: no (solo project)"
echo ""

gh api \
  --method PUT \
  "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [{"context": "CI", "app_id": -1}]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo ""
echo "Branch protection configured successfully for ${BRANCH}."
echo ""
echo "Rules applied:"
echo "  - Direct push to main: BLOCKED"
echo "  - Force push to main: BLOCKED"
echo "  - CI status check: REQUIRED"
echo "  - Admins: ENFORCED (no bypass)"
