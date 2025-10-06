# v0 Integration - Complete Guide

## Overview

The platform now integrates **v0 Platform API** for intelligent UI component generation, combined with automated validation and multi-agent support.

---

## How It Works

### Smart Detection Flow:

\`\`\`
User Prompt
  ↓
Is UI-focused? (button, form, component, etc.)
  ↙          ↘
YES           NO
  ↓            ↓
v0 Gen      Agent
  ↓            ↓
Write       Execute
Component     ↓
  ↓            ↓
  └──→ Playwright Tests
         ↓
      Validate
         ↓
      Pass/Retry/Rollback
\`\`\`

### Example Prompts:

**UI-Focused (uses v0):**
- "Create a contact form with email validation"
- "Add a responsive navbar component"
- "Build a dashboard layout with sidebar"

**Non-UI (uses agent directly):**
- "Fix the authentication bug in login.ts"
- "Add API endpoint for user registration"
- "Update README with deployment instructions"

---

## Configuration

### Enable v0 Integration

In `.env.local`:
\`\`\`bash
# Required for v0
V0_API_KEY=your_v0_api_key_here

# Required for test generation
AI_GATEWAY_API_KEY=your_openai_key
\`\`\`

Get your v0 API key from: [v0.dev](https://v0.dev)

### In Code:

\`\`\`typescript
const validationResult = await executeAgentWithValidation(
  sandbox,
  prompt,
  agentType,
  logger,
  selectedModel,
  {
    enableValidation: true,
    v0Config: {
      enableV0: true,           // Toggle v0 integration
      framework: 'react',       // react | nextjs | vue | svelte
      styling: 'tailwind',      // tailwind | css | styled-components
    },
  },
)
\`\`\`

---

## Complete Workflow

### Example: "Create a contact form component"

**Step 1: v0 Generation**
\`\`\`
✅ UI-focused prompt detected
🎨 Generating UI component with v0...
✅ v0 component generated successfully
📝 Writing to: components/ContactForm.tsx
\`\`\`

**Step 2: Agent Enhancement**
\`\`\`
📝 Executing claude agent...
✅ Agent adds validation logic, error handling
✅ Integrates component into app
\`\`\`

**Step 3: Automated Testing**
\`\`\`
🧪 Generating Playwright tests...
✅ Tests generated: e2e/tests/ContactForm.spec.ts
📦 Installing Playwright...
🧪 Running tests...
\`\`\`

**Step 4: Validation Results**
\`\`\`
✅ All tests passed! (5/5)
  ✓ Form renders correctly
  ✓ Email validation works
  ✓ Submit button enabled/disabled
  ✓ Error messages display
  ✓ Success state shows
\`\`\`

---

## Agent Compatibility

All agents now support v0 integration:

| Agent | Docker | v0 Integration | Status |
|-------|--------|----------------|--------|
| Claude Code | ✅ | ✅ | Full support |
| Codex CLI | ✅ | ✅ | Full support |
| Cursor CLI | ✅ | ✅ | Full support |
| Gemini CLI | ✅ | ✅ | Full support |
| OpenCode | ✅ | ✅ | Full support |

### How Agents Use v0:

1. **v0 generates** the initial UI component
2. **Agent refines** with business logic, integration, styling tweaks
3. **Playwright validates** the final result
4. **Retry logic** fixes any issues (max 3 attempts)
5. **Rollback** if stuck in error loop

---

## API Reference

### `executeV0IfNeeded()`

Automatically detects UI prompts and generates with v0.

\`\`\`typescript
const result = await executeV0IfNeeded(
  sandbox,
  'Create a pricing card component',
  logger,
  {
    enableV0: true,
    framework: 'nextjs',
    styling: 'tailwind',
  },
)

if (result.v0Used && result.success) {
  console.log('v0 component generated!')
}
\`\`\`

### `generateV0Component()`

Direct v0 generation (manual control).

\`\`\`typescript
const result = await generateV0Component(
  {
    prompt: 'Modern login form with social auth buttons',
    framework: 'react',
    styling: 'tailwind',
  },
  logger,
)

console.log(result.code)        // Generated component code
console.log(result.componentName) // e.g., "LoginForm"
console.log(result.filePath)    // e.g., "components/LoginForm.tsx"
\`\`\`

### `isUIPrompt()`

Check if a prompt is UI-focused.

\`\`\`typescript
isUIPrompt('Create a button component')      // true
isUIPrompt('Fix authentication bug')         // false
isUIPrompt('Add contact form to homepage')   // true
isUIPrompt('Update database schema')         // false
\`\`\`

---

## UI Keywords Detection

The system automatically detects UI-focused prompts using these keywords:

- component, button, form, modal, card
- navbar, header, footer, sidebar, menu
- dropdown, table, list, grid, layout
- page, dashboard, ui, interface, design

---

## Cost Optimization

### When v0 is Used:
- UI component generation: **~$0.01 per component**
- Playwright test generation: **~$0.01 per test suite**
- Total cost per UI task: **~$0.02-0.05**

### When v0 is NOT Used:
- Only agent execution cost (varies by agent)
- No additional v0 API charges

### Pro Tips:
1. **Disable v0 for non-UI tasks** to save costs
2. **Use Claude/Codex directly** for backend work
3. **Enable v0 only when needed** (UI components, pages, layouts)

---

## Advanced Usage

### Disable v0 for Specific Task

\`\`\`typescript
const result = await executeAgentWithValidation(
  sandbox,
  prompt,
  agentType,
  logger,
  selectedModel,
  {
    v0Config: {
      enableV0: false,  // Skip v0, use agent only
    },
  },
)
\`\`\`

### Custom Component Path

Currently auto-detected:
- React/Next.js → `components/ComponentName.tsx`
- Vue → `src/components/ComponentName.vue`
- Svelte → `src/components/ComponentName.svelte`

### Framework-Specific Generation

\`\`\`typescript
// Next.js App Router
v0Config: {
  framework: 'nextjs',
  styling: 'tailwind',
}

// Vue 3 Composition API
v0Config: {
  framework: 'vue',
  styling: 'css',
}

// Svelte + SvelteKit
v0Config: {
  framework: 'svelte',
  styling: 'tailwind',
}
\`\`\`

---

## Troubleshooting

### "V0_API_KEY not configured"
**Solution:** Add `V0_API_KEY=your_key` to `.env.local`

### "v0 generation failed"
**Causes:**
- Invalid API key
- Rate limit exceeded
- Network issues

**Solution:** System automatically falls back to agent execution

### "v0 component not rendering"
**Check:**
1. Is component exported correctly?
2. Is it imported in the app?
3. Are dependencies installed?

**Solution:** Agent will handle integration after v0 generates

### "Tests failing after v0 generation"
**Expected behavior** - retry logic will:
1. Attempt 1: v0 generates component
2. Attempt 2: Agent fixes integration issues
3. Attempt 3: Agent refines based on test errors
4. Rollback if still failing

---

## Examples

### Example 1: Hero Section

**Prompt:**
\`\`\`
Create a modern hero section with gradient background, headline,
subtext, and CTA button
\`\`\`

**Process:**
1. ✅ UI-focused detected
2. v0 generates hero component
3. Agent integrates into homepage
4. Tests validate rendering and responsiveness
5. **Result:** Working hero section in ~2 minutes

### Example 2: Dashboard Layout

**Prompt:**
\`\`\`
Build a dashboard layout with sidebar navigation, header,
and main content area
\`\`\`

**Process:**
1. v0 generates layout structure
2. Agent adds routing logic
3. Tests validate navigation
4. **Result:** Complete dashboard skeleton

### Example 3: Non-UI Task

**Prompt:**
\`\`\`
Add error handling to the API endpoints
\`\`\`

**Process:**
1. ❌ Not UI-focused
2. Agent executes directly (no v0)
3. Tests validate error handling
4. **Result:** Improved error handling

---

## Metrics

Track v0 usage in logs:

\`\`\`
[Attempt 1] UI-focused prompt detected, using v0
[Attempt 1] v0 component generated: ContactForm.tsx
[Attempt 1] Playwright tests: 5/5 passed
SUCCESS - v0 + validation completed in 1 attempt
\`\`\`

---

## Next Steps

Now that all agents + v0 integration is complete, you can:

1. ✅ **Test the system** - Create UI tasks and watch v0 + validation
2. ✅ **Monitor costs** - Track v0 API usage
3. ⏳ **Build master orchestrator** - Break complex prompts into steps
4. ⏳ **Add project mapper** - Full project blueprints

**The platform now has:**
- Free Docker execution
- 5 agents (Claude, Codex, Cursor, Gemini, OpenCode)
- v0 UI generation
- Automated validation
- Smart retry + rollback
- Error pattern recognition

This is your **MVP validation platform with v0 integration** 🚀
