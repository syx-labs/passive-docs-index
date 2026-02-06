# Phase 2: User Setup Required

## Coverage Badge (One-Time Setup)

The CI workflow updates a coverage badge on push to main using [schneegans/dynamic-badges-action](https://github.com/Schneegans/dynamic-badges-action). This requires a GitHub Gist to store the badge data.

### Steps

1. **Create a public Gist**
   - Go to https://gist.github.com
   - Create a new public Gist with any filename (e.g., `coverage.json`)
   - Content can be empty or `{}`
   - Copy the Gist ID from the URL (the hash after your username)

2. **Create a GitHub Personal Access Token (PAT)**
   - Go to https://github.com/settings/tokens
   - Create a new token (classic) with only the `gist` scope
   - Copy the token value

3. **Add repository secret: `GIST_SECRET`**
   - Go to your repo > Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `GIST_SECRET`
   - Value: the PAT from step 2

4. **Add repository variable: `COVERAGE_GIST_ID`**
   - Go to your repo > Settings > Secrets and variables > Actions > Variables tab
   - Click "New repository variable"
   - Name: `COVERAGE_GIST_ID`
   - Value: the Gist ID from step 1

### Verification

After the next push to main with code changes, the badge JSON will be updated in your Gist. You can then add a badge to your README:

```markdown
![Coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/{YOUR_USERNAME}/{GIST_ID}/raw/coverage.json)
```

## Branch Protection (One-Time Setup)

After the CI workflow has been pushed and has run at least once:

```bash
./scripts/setup-branch-protection.sh
```

This requires the `gh` CLI to be authenticated with admin access to the repository.
