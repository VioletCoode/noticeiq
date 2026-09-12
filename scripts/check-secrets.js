import { execSync } from 'child_process';

const BLOCKED_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.(?!example$|template$)/i,
  /\/\.env$/i,
  /\/\.env\.(?!example$|template$)/i,
];

const SECRET_REGEX_RULES = [
  {
    name: 'Gemini API Key (AQ.* format)',
    regex: /AQ\.[A-Za-z0-9_-]{30,}/,
  },
  {
    name: 'Google API Key (AIza format)',
    regex: /AIza[0-9A-Za-z-_]{35}/,
  },
  {
    name: 'Supabase Key (Publishable or Secret)',
    regex: /sb_(?:publishable|secret)_[A-Za-z0-9_-]{20,}/,
  },
  {
    name: 'JWT Token Pattern',
    regex: /eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: 'Groq API Key (gsk_ format)',
    regex: /gsk_[A-Za-z0-9_-]{25,}/,
  },
  {
    name: 'Hardcoded Secret Assignment',
    regex: /(?:API_KEY|SECRET_KEY|AUTH_TOKEN|PRIVATE_KEY)\s*[:=]\s*['"][A-Za-z0-9_-]{25,}['"]/i,
  },
];

function checkStaged() {
  console.log('[Security Check] Inspecting staged files for secrets...');

  let stagedFiles = [];
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
    stagedFiles = output ? output.split(/\r?\n/).map(f => f.trim()).filter(Boolean) : [];
  } catch (err) {
    console.error('[Security Check] Failed to query git staged files:', err.message);
    process.exit(1);
  }

  if (stagedFiles.length === 0) {
    console.log('[Security Check] No staged files found. Skipping.');
    process.exit(0);
  }

  // 1. Check file names
  let violations = [];
  for (const file of stagedFiles) {
    for (const pattern of BLOCKED_FILE_PATTERNS) {
      if (pattern.test(file)) {
        violations.push(`Blocked secrets file staged: ${file}`);
      }
    }
  }

  // 2. Check staged diff content
  try {
    const diff = execSync('git diff --cached -U0', { encoding: 'utf8' });
    const lines = diff.split(/\r?\n/);
    let currentFile = 'unknown';

    for (const line of lines) {
      if (line.startsWith('+++ b/')) {
        currentFile = line.substring(6).trim();
        continue;
      }

      // Only check added lines
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const addedContent = line.substring(1);

        // Ignore comments in documentation or placeholder lines
        if (addedContent.includes('your_') || addedContent.includes('<PROJECT_REF>') || addedContent.includes('<ANON_')) {
          continue;
        }

        for (const rule of SECRET_REGEX_RULES) {
          if (rule.regex.test(addedContent)) {
            violations.push(`Found ${rule.name} in staged file "${currentFile}"`);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Security Check] Failed to inspect git diff:', err.message);
    process.exit(1);
  }

  if (violations.length > 0) {
    console.error('\n============================================================');
    console.error('🛑 COMMIT REJECTED: Potential secret or API key detected!');
    console.error('============================================================');
    violations.forEach(v => console.error(` - ${v}`));
    console.error('\nPlease remove sensitive keys before committing.');
    console.error('Use environment variables (.env) or secret managers instead.');
    console.error('============================================================\n');
    process.exit(1);
  }

  console.log('✅ [Security Check] Passed: No secret keys or .env files detected in staged changes.\n');
  process.exit(0);
}

checkStaged();
