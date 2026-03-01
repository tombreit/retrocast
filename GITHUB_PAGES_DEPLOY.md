# GitHub Pages Multi-Branch Deployment

## Overview

This repository implements a multi-branch deployment to GitHub Pages, allowing users to switch between different versions of RetroCast (implementations by different LLMs) through a single entry menu.

## Deployment Architecture

### Structure

```
gh-pages (deployment):
├── index.html              ← Entry menu (entry-menu.html)
├── branches.json           ← Branch configuration
├── main/
│   ├── index.html          ← From main branch
│   ├── styles/
│   └── scripts/
├── glm47/
│   ├── index.html          ← From glm47 branch
│   ├── styles/
│   └── scripts/
└── qwen-coder/
    ├── index.html          ← From qwen-coder branch
    ├── styles/
    └── scripts/
```

### URLs

- `https://tombreit.github.io/retrocast/` → Entry menu
- `https://tombreit.github.io/retrocast/main/` → Main branch
- `https://tombreit.github.io/retrocast/glm47/` → GLM-4.7 version
- `https://tombreit.github.io/retrocast/qwen-coder/` → Qwen-Coder version

## Configuration Files

### branches.json

Located at repository root, this file configures which branches are deployed and their metadata.

```json
{
  "main": {
    "name": "Main",
    "url": "main"
  },
  "glm47": {
    "name": "GLM-4.7",
    "url": "glm47"
  },
  "qwen-coder": {
    "name": "Qwen-Coder",
    "url": "qwen-coder"
  }
}
```

**To add a new branch:**

1. Create and push your branch:
   ```bash
   git checkout -b new-branch
   # ... make changes ...
   git push -u origin new-branch
   ```

2. Update `branches.json`:
   ```json
   {
     "new-branch": {
       "name": "New Branch",
       "url": "new-branch"
     }
   }
   ```

3. Update `.github/workflows/multi-branch-deploy.yml`:
   ```yaml
   on:
     push:
       branches: [main, glm47, qwen-coder, new-branch]
   ```

4. Push changes:
   ```bash
   git add branches.json .github/workflows/multi-branch-deploy.yml
   git commit -m "Add new-branch to deployment"
   git push
   ```

**To remove a branch:**

Simply remove the branch from `branches.json` and update the workflow trigger, then push.

### entry-menu.html

The entry menu is a minimal landing page that lists all configured branches. It automatically reads `branches.json` and generates clickable cards for each branch.

**Features:**
- Clean, minimal design (branch names only)
- Responsive grid layout
- Dark mode support (inherits from main's CSS)
- Hover effects for better UX
- Links directly to each branch's subdirectory

## GitHub Actions Workflow

### File: `.github/workflows/multi-branch-deploy.yml`

**Triggers:**
- Automatic: On push to main branch only
- Manual: Via GitHub Actions UI (workflow_dispatch) - use this to redeploy after changes to glm47 or qwen-coder

**Workflow Steps:**

1. **Checkout Repository**
   - Fetches all branches (`fetch-depth: 0`)
   - Allows switching between branches

2. **Read branches.json**
   - Parses configuration file
   - Outputs list of branches as comma-separated string

3. **Validate Branches**
   - Checks if each configured branch exists
   - Fails workflow if any branch is missing
   - Prevents partial deployments

4. **Build Deployment**
   - For each branch:
     - Checkout the branch
     - Copy `index.html`, `styles/`, `scripts/` to `_site/<branch>/`
   - Copy `branches.json` and `entry-menu.html` to `_site/` root
   - `set -e` ensures workflow fails on any error

5. **Setup Pages**
   - Configures GitHub Pages settings

6. **Upload Artifact**
   - Uploads `_site/` directory as Pages artifact

7. **Deploy to GitHub Pages**
   - Deploys artifact to `gh-pages` branch

8. **Cleanup**
   - Removes temporary files
   - Returns to main branch

**Error Handling:**
- Workflow fails completely if any step fails
- Provides descriptive error messages
- Cleanup step always runs (even on failure)

### Existing Deploy Workflow

The original `.github/workflows/deploy.yml` is kept as a backup. It's not actively used but can be restored if needed.

## Deployment Process

### Automatic Deployment

When you push to the **main branch** only:

1. GitHub detects the push event
2. Triggers `multi-branch-deploy.yml` workflow
3. Workflow fetches and processes all branches (main, glm47, qwen-coder)
4. Updates `gh-pages` branch
5. GitHub Pages serves the new deployment

**Note:** Pushes to glm47 or qwen-coder do NOT automatically trigger deployment. Use manual deployment to deploy changes from those branches.

### Manual Deployment

Use manual deployment to deploy changes made to glm47 or qwen-coder branches, or to force a redeploy.

1. Go to: https://github.com/tombreit/retrocast/actions
2. Select "Multi-Branch Deploy to GitHub Pages"
3. Click "Run workflow" dropdown
4. Click "Run workflow" button

This is useful for:
- Force redeploy after workflow failures
- Testing the deployment process
- Redeploying without git changes

### Deployment Logs

View deployment progress:
1. Go to Actions tab in GitHub
2. Click on the latest workflow run
3. Expand "Build deployment" step to see details

## LocalStorage Behavior

All branches share the same localStorage namespace. This means:
- User's favorites are visible across all versions
- Last selected location is preserved across versions
- Banner dismissal state is shared across versions

**Storage keys used:**
- `retrocast_active_location` - Last selected location
- `retrocast_favorites` - Saved favorites list
- `retrocast_banner_closed` - Whether info banner was dismissed

**No code changes needed** - this sharing is automatic and doesn't require branch-specific modifications.

## Testing the Deployment

### Initial Testing

1. **Verify workflow file:**
   ```bash
   cat .github/workflows/multi-branch-deploy.yml
   ```

2. **Verify configuration files exist:**
   ```bash
   ls -la branches.json entry-menu.html
   ```

3. **Test in a test branch:**
   ```bash
   # Create a test branch
   git checkout -b test-deploy
   echo "test" > test.md
   git add test.md
   git commit -am "Test"
   git push -u origin test-deploy
   
   # Update branches.json temporarily
   # Update workflow trigger to include test-deploy
   # Push and monitor workflow
   ```

4. **Monitor workflow:**
   - Watch GitHub Actions tab
   - Check for errors
   - Verify gh-pages branch

### Browser Testing

After successful deployment:

1. **Visit entry menu:**
   - https://tombreit.github.io/retrocast/

2. **Test each branch:**
   - Click "Main" → https://tombreit.github.io/retrocast/main/
   - Click "GLM-4.7" → https://tombreit.github.io/retrocast/glm47/
   - Click "Qwen-Coder" → https://tombreit.github.io/retrocast/qwen-coder/

3. **Test localStorage sharing:**
   - Add a favorite in Main version
   - Switch to GLM-4.7 version
   - Verify favorite is visible

4. **Test responsive design:**
   - Open on mobile device
   - Open on desktop
   - Verify layout works correctly

5. **Test dark mode:**
   - Toggle system dark mode
   - Verify entry menu adapts
   - Verify all versions adapt

## Troubleshooting

### Workflow Fails to Trigger

**Symptoms:** Workflow doesn't run after pushing

**Solutions:** 
1. **Note:** Automatic trigger only works for the `main` branch. Pushes to glm47 or qwen-coder require manual deployment.
2. To deploy changes from glm47 or qwen-coder, use manual trigger:
   - Go to: https://github.com/tombreit/retrocast/actions
   - Select "Multi-Branch Deploy to GitHub Pages"
   - Click "Run workflow" → "Run workflow"

2. Check workflow file syntax:
   - Look for syntax errors (quotes, indentation)

3. Verify GitHub Actions is enabled:
   - Settings → Actions → General
   - Check "Allow all actions and reusable workflows"

### Branch Checkout Error

**Symptoms:** Workflow fails with "Failed to checkout branch"

**Solutions:**
1. Verify branch exists:
   ```bash
   git branch -r
   ```

2. Verify branch is pushed to origin:
   ```bash
   git push origin branch-name
   ```

3. Check branch spelling in `branches.json`

### File Copy Error

**Symptoms:** Workflow fails during file copying

**Solutions:**
1. Verify files exist in branch:
   ```bash
   git checkout branch-name
   ls -la index.html styles/ scripts/
   ```

2. Check file permissions

3. Verify `branches.json` contains correct URL path

### Entry Menu Not Loading

**Symptoms:** Entry menu shows blank cards

**Solutions:**
1. Check browser console for errors (F12)
2. Verify `branches.json` is accessible:
   - https://tombreit.github.io/retrocast/branches.json

3. Verify `entry-menu.html` exists in root

### Wrong Version Deployed

**Symptoms:** Changes not appearing after push

**Solutions:**
1. Check workflow logs for errors
2. Verify correct branch was pushed to
3. Check gh-pages branch content
4. Wait 1-2 minutes for GitHub Pages CDN to update

## Performance

### Workflow Runtime

Typical execution time: 30-60 seconds

- Branch checkouts: 10-15 seconds
- File copying: 5 seconds
- Artifact upload: 10-20 seconds
- Deploy: 5-10 seconds

### GitHub Pages Caching

GitHub Pages automatically caches content at CDN level. Users typically see content within 1-2 seconds of deployment.

### Optimization Notes

For this small repository, no additional caching or optimization is needed. The workflow is already optimized for speed and reliability.

## Maintenance

### Adding New LLM Implementations

When adding a new LLM implementation:

1. Create a new branch based on main:
   ```bash
   git checkout main
   git checkout -b new-llm-name
   ```

2. Implement the features with the new LLM

3. Test thoroughly

4. Update `branches.json`:
   ```json
   {
     "new-llm-name": {
       "name": "New LLM Name",
       "url": "new-llm-name"
     }
   }
   ```

5. Update workflow trigger:
   ```yaml
   on:
     push:
       branches: [main, glm47, qwen-coder, new-llm-name]
   ```

6. Push all changes:
   ```bash
   git push -u origin new-llm-name
   git checkout main
   git add branches.json .github/workflows/multi-branch-deploy.yml
   git commit -am "Add new-llm-name to deployment"
   git push
   ```

### Updating Existing Branches

To update an existing branch:

```bash
git checkout glm47
# ... make changes ...
git commit -am "Update feature"
git push
```

The workflow will automatically deploy the updated version along with all other branches.

### Cleaning Up Old Branches

To remove a branch from deployment:

1. Remove from `branches.json`
2. Update workflow trigger
3. Push changes
4. Optionally delete the branch from GitHub:
   ```bash
   git push origin --delete branch-name
   ```

## Security Considerations

### Workflow Permissions

The workflow requires:
- `contents: read` - Access repository content
- `pages: write` - Deploy to GitHub Pages
- `id-token: write` - OIDC token for Pages deployment

These permissions are minimal and scoped to only what's needed.

### No Secrets Required

This deployment doesn't require any GitHub Actions secrets or tokens. Everything is done using OIDC tokens managed by GitHub.

## Resources

### GitHub Documentation
- [GitHub Pages Documentation](https://docs.github.com/pages)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Deploying to GitHub Pages](https://docs.github.com/actions/deployment/targeting-different-environments/deploying-to-github-pages)

### Repository Links
- Repository: https://github.com/tombreit/retrocast
- Actions: https://github.com/tombreit/retrocast/actions
- Deployed Site: https://tombreit.github.io/retrocast/

### Related Files
- `branches.json` - Branch configuration
- `entry-menu.html` - Entry page UI
- `.github/workflows/multi-branch-deploy.yml` - Deployment workflow
- `.github/workflows/deploy.yml` - Original workflow (backup)

## Support

If you encounter issues:

1. Check this documentation first
2. Review GitHub Actions workflow logs
3. Check browser console for JavaScript errors
4. Verify all configuration files are correct

For persistent issues, create an issue in the repository with:
- Description of the problem
- Steps to reproduce
- Error messages from workflow or browser
- Screenshots if applicable