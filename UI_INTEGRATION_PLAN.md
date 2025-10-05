# UI Integration Plan: Merging v0-Clone with Current Task Management

## Overview

Merge the **v0-clone chat interface + live preview** with the **existing agent picker + task management sidebar** to create a unified platform with two modes:

1. **Build App Mode** - One-time scaffold using v0 + agent refinement
2. **Add Features Mode** - Ongoing development on existing projects with validation

---

## Component Analysis

### From v0-Clone (Extract These)

#### 1. **PromptInput** (`components/ui/prompt-input.tsx`)
- Black rounded pill design with avatar
- Divider line between avatar and input
- Enter to submit, loading spinner
- **Keep**: Aesthetic, user avatar integration
- **Adapt**: Make agent-aware (show selected agent icon)

#### 2. **Preview** (`components/layout/preview.tsx`)
- Live iframe preview with fade transitions
- Multiple generations support (A, B, C)
- Loading spinner while demo loads
- **Keep**: Full preview system
- **Adapt**: Support both v0 demo URLs and local dev server preview

#### 3. **GenerationsView** (`components/shared/generations-view.tsx`)
- Main layout: Header + Preview + Thumbnails + Follow-up input
- Coordinates all subcomponents
- **Keep**: Layout structure
- **Adapt**: Make mode-aware (Build vs Features)

#### 4. **Thumbnails** (`components/layout/thumbnails.tsx`)
- 3 generation thumbnails + 1 regenerate slot
- Screenshot API integration
- Hover actions (refresh, navigate)
- **Keep**: For Build Mode
- **Skip**: In Features Mode (show validation results instead)

#### 5. **Header** (`components/layout/header.tsx`)
- Shows user avatar + prompt badge
- "New +" and "Duplicate" buttons
- **Keep**: User avatar, prompt display
- **Adapt**: Replace buttons with mode-appropriate actions

#### 6. **HistorySidebar** (`components/layout/history-sidebar.tsx`)
- Iterative refinement history (v1, v2, v3...)
- Version selection
- **Keep**: For both modes (shows iteration history)
- **Adapt**: In Features mode, show validation attempt history

---

### From Current Platform (Keep These)

#### 1. **TaskForm** (`components/task-form.tsx`)
- **Agent Picker** - Claude, Codex, Cursor, Gemini, OpenCode with icons
- **Model Selector** - Per-agent model selection
- **Options Dialog** - Install deps, max duration
- **Repository Selection** - GitHub repo picker
- **Keep**: Entire form, agent picker is core feature
- **Adapt**: Integrate into initial prompt input

#### 2. **Task Sidebar** (from AppLayout)
- List of all tasks with status
- Quick navigation between tasks
- **Keep**: Essential for multi-task management
- **Move**: To left sidebar always visible

#### 3. **Task Detail Page** (`components/task-page-client.tsx`)
- Logs viewer with real-time updates
- Stop/retry buttons
- Git diff viewer
- **Keep**: Core validation feedback
- **Adapt**: Show alongside preview in Features mode

---

## Unified Layout Structure

### Mode Toggle Component
```typescript
// components/mode-toggle.tsx
export function ModeToggle() {
  return (
    <div className="flex items-center gap-2 p-2 bg-muted rounded-full">
      <Button
        variant={mode === 'build' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setMode('build')}
      >
        Build App
      </Button>
      <Button
        variant={mode === 'features' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setMode('features')}
      >
        Add Features
      </Button>
    </div>
  )
}
```

### Layout Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│ Top Bar                                                          │
│ [Logo] [Mode Toggle] [User Avatar] [Settings]                   │
└─────────────────────────────────────────────────────────────────┘
┌──────────┬───────────────────────────────────────────┬──────────┐
│          │                                            │          │
│  Tasks   │          Main Content Area                │ Preview  │
│ Sidebar  │                                            │  Panel   │
│          │  ┌─────────────────────────────────────┐  │          │
│ [Task 1] │  │ Prompt Input with Agent Picker      │  │ ┌──────┐ │
│ [Task 2] │  │ [Avatar] | [Prompt...] [Agent] [▲] │  │ │      │ │
│ [Task 3] │  └─────────────────────────────────────┘  │ │ Live │ │
│   ...    │                                            │ │ Prev │ │
│          │  ┌─────────────────────────────────────┐  │ │ iew  │ │
│ [+ New]  │  │                                     │  │ │      │ │
│          │  │     Content varies by mode:         │  │ └──────┘ │
│          │  │                                     │  │          │
│          │  │   BUILD MODE:                       │  │ Thumbs   │
│          │  │   - Empty state or suggestions      │  │ ┌─┬─┬─┬─┐│
│          │  │   - Generation progress             │  │ │A│B│C│R││
│          │  │   - 3 variations loading            │  │ └─┴─┴─┴─┘│
│          │  │                                     │  │          │
│          │  │   FEATURES MODE:                    │  │ History  │
│          │  │   - Validation logs                 │  │ ┌──────┐ │
│          │  │   - Playwright test results         │  │ │ v1   │ │
│          │  │   - Git diff viewer                 │  │ │ v2   │ │
│          │  │   - Retry/rollback controls         │  │ │ v3   │ │
│          │  │                                     │  │ └──────┘ │
│          │  └─────────────────────────────────────┘  │          │
└──────────┴───────────────────────────────────────────┴──────────┘
```

---

## Implementation Phases

### Phase 1: Shared Components (Extract from v0-clone)

**Files to Create:**

1. **`components/shared/prompt-input-v2.tsx`**
   - Based on v0-clone's PromptInput
   - Add agent/model picker inline
   - Support both initial and follow-up prompts
   ```tsx
   interface PromptInputV2Props {
     variant: 'initial' | 'followup'
     selectedAgent?: string
     selectedModel?: string
     onAgentChange?: (agent: string) => void
     onModelChange?: (model: string) => void
     // ... rest from v0-clone
   }
   ```

2. **`components/shared/live-preview.tsx`**
   - Copy from v0-clone's Preview
   - Support both v0 demo URLs and localhost URLs
   - Add error states for failed previews
   ```tsx
   interface LivePreviewProps {
     previewUrl: string
     isLoading?: boolean
     error?: string
   }
   ```

3. **`components/shared/generation-thumbnails.tsx`**
   - Copy from v0-clone's Thumbnails
   - Only used in Build mode
   ```tsx
   interface GenerationThumbnailsProps {
     generations: Array<{ id: string; demoUrl: string; label: string }>
     selectedIndex: number
     onSelect: (index: number) => void
     onRegenerate: () => void
   }
   ```

4. **`components/shared/validation-panel.tsx`**
   - New component for Features mode
   - Shows logs, tests, git diff
   - Combines current TaskPageClient functionality
   ```tsx
   interface ValidationPanelProps {
     taskId: string
     logs: string[]
     testResults?: TestResults
     gitDiff?: string
     onRetry: () => void
     onStop: () => void
   }
   ```

---

### Phase 2: Mode-Specific Pages

**Files to Create:**

1. **`app/build/page.tsx`** (Build App Mode)
   - Initial prompt input with agent picker
   - Triggers v0 generation (if UI-focused)
   - Shows 3 generations A/B/C
   - Live preview on right
   - Follow-up refinements
   - When satisfied → "Create Project" → saves to database

2. **`app/features/page.tsx`** (Add Features Mode)
   - Shows existing tasks sidebar
   - Task form with validation enabled
   - Live preview on right
   - Validation panel in center
   - Iteration history on right

3. **`components/mode-layout.tsx`**
   - Wrapper that provides mode context
   - Shared top bar with mode toggle
   - Common sidebar structure
   ```tsx
   interface ModeLayoutProps {
     mode: 'build' | 'features'
     children: React.ReactNode
     showTasksSidebar?: boolean
     showPreviewPanel?: boolean
   }
   ```

---

### Phase 3: Build Mode Implementation

**Workflow:**

1. User clicks "Build App" mode
2. Navigates to `/build`
3. Sees centered prompt input with agent picker
4. Types: "Create a task management app with kanban board"
5. Selects Claude + Sonnet 4.5
6. Submits
7. **Backend detects UI-focused**:
   - Calls v0 API to generate 3 variations
   - Returns 3 demo URLs
8. **Frontend**:
   - Shows 3 thumbnail previews (A, B, C)
   - Live preview shows selected generation
   - User can switch between A/B/C
9. **Follow-up refinements**:
   - User types: "Make the buttons larger"
   - v0 updates selected generation
   - Preview refreshes
10. **Finalize**:
    - User clicks "Create Project"
    - Saves to database with project name
    - Optionally pushes to GitHub
    - Switches to Features mode for that project

**API Endpoints to Create:**

```typescript
// app/api/build/route.ts
POST /api/build
{
  prompt: string
  agent: string
  model: string
}
→ Returns { generations: [{ id, demoUrl, label }] }

POST /api/build/refine
{
  generationId: string
  prompt: string
}
→ Returns { updatedDemoUrl: string }

POST /api/build/finalize
{
  selectedGenerationId: string
  projectName: string
  repoUrl?: string
}
→ Creates project in DB, optionally pushes to GitHub
```

---

### Phase 4: Features Mode Implementation

**Workflow:**

1. User has existing project (created in Build mode or manually)
2. Clicks "Add Features" mode
3. Navigates to `/features` or `/features/[projectId]`
4. Sees task sidebar with previous tasks
5. Types new prompt: "Add user authentication"
6. Selects agent + model
7. Submits
8. **Backend**:
   - Clones repo
   - Creates new branch
   - Executes agent with validation
   - Generates Playwright tests
   - Runs tests (max 3 attempts)
9. **Frontend**:
   - Shows validation logs in center panel
   - Live preview on right (localhost:3000)
   - Test results update in real-time
   - Iteration history shows v1, v2, v3 if retries
10. **Success**:
    - All tests pass
    - Shows git diff
    - User can create PR or continue iterating

**Already Implemented** - Just needs UI integration:
- Validation orchestrator
- Test generation
- Retry logic
- Rollback engine

---

### Phase 5: Mode Toggle & Navigation

**Global State (Jotai/Zustand):**

```typescript
// lib/store/mode.ts
import { atom } from 'jotai'

export const modeAtom = atom<'build' | 'features'>('features')
export const currentProjectAtom = atom<string | null>(null)
```

**Top Bar Component:**

```tsx
// components/top-bar.tsx
export function TopBar() {
  const [mode, setMode] = useAtom(modeAtom)
  const router = useRouter()

  const handleModeChange = (newMode: 'build' | 'features') => {
    setMode(newMode)
    router.push(newMode === 'build' ? '/build' : '/features')
  }

  return (
    <div className="border-b p-4 flex items-center justify-between">
      <Logo />
      <ModeToggle mode={mode} onChange={handleModeChange} />
      <UserMenu />
    </div>
  )
}
```

---

## Component Reusability Matrix

| Component | Build Mode | Features Mode | Shared |
|-----------|------------|---------------|--------|
| PromptInputV2 | ✅ Initial | ✅ Task form | ✅ |
| LivePreview | ✅ v0 demos | ✅ localhost | ✅ |
| GenerationThumbnails | ✅ A/B/C | ❌ | ❌ |
| ValidationPanel | ❌ | ✅ Logs/tests | ❌ |
| TaskSidebar | ❌ | ✅ All tasks | ❌ |
| IterationHistory | ✅ v1/v2/v3 | ✅ Attempts | ✅ |
| AgentPicker | ✅ | ✅ | ✅ |
| ModelSelector | ✅ | ✅ | ✅ |

---

## File Structure (New)

```
app/
├── build/
│   ├── page.tsx                    # Build App mode
│   └── [generationId]/
│       └── page.tsx                # Refinement view
├── features/
│   ├── page.tsx                    # Add Features mode (list)
│   └── [projectId]/
│       ├── page.tsx                # Project-specific features
│       └── tasks/[taskId]/
│           └── page.tsx            # Task detail with validation
└── api/
    ├── build/
    │   ├── route.ts                # Initial generation
    │   ├── refine/route.ts         # Follow-up refinements
    │   └── finalize/route.ts       # Save project
    └── features/
        └── [existing tasks API]

components/
├── shared/
│   ├── prompt-input-v2.tsx         # Unified prompt input
│   ├── live-preview.tsx            # Live iframe preview
│   ├── generation-thumbnails.tsx   # A/B/C thumbnails
│   ├── validation-panel.tsx        # Logs + tests + diff
│   └── iteration-history.tsx      # v1/v2/v3 sidebar
├── build-mode/
│   ├── build-layout.tsx            # Build mode layout
│   └── generation-selector.tsx    # A/B/C + Regenerate
├── features-mode/
│   ├── features-layout.tsx         # Features mode layout
│   └── task-validation-view.tsx   # Validation results
└── layout/
    ├── top-bar.tsx                 # Global top bar
    ├── mode-toggle.tsx             # Build/Features toggle
    └── task-sidebar.tsx            # Left sidebar (tasks)

lib/
├── store/
│   ├── mode.ts                     # Mode state (build/features)
│   └── build.ts                    # Build mode state
└── api/
    └── build-client.ts             # Client-side build API calls
```

---

## API Integration Points

### Build Mode API Flow

```typescript
// 1. Initial generation
const response = await fetch('/api/build', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Create a task management app',
    agent: 'claude',
    model: 'claude-sonnet-4-5-20250929'
  })
})
// Returns: { generations: [{ id, demoUrl, label: 'A' }, ...] }

// 2. Refinement
await fetch('/api/build/refine', {
  method: 'POST',
  body: JSON.stringify({
    generationId: 'gen-123',
    prompt: 'Make buttons larger'
  })
})
// Returns: { updatedDemoUrl: string }

// 3. Finalize
await fetch('/api/build/finalize', {
  method: 'POST',
  body: JSON.stringify({
    selectedGenerationId: 'gen-123',
    projectName: 'My Task Manager',
    repoUrl: 'https://github.com/user/repo.git' // Optional
  })
})
// Returns: { projectId: string }
```

### Features Mode API Flow

**Already implemented** - uses existing `/api/tasks` with validation:

```typescript
const response = await fetch('/api/tasks', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Add user authentication',
    repoUrl: 'https://github.com/user/my-task-manager.git',
    selectedAgent: 'claude',
    selectedModel: 'claude-sonnet-4-5-20250929',
    // Validation enabled by default
  })
})
// Triggers validation orchestrator → test gen → retry logic
```

---

## Implementation Order

### Week 1: Shared Components
1. ✅ Extract `PromptInputV2` from v0-clone
2. ✅ Extract `LivePreview` from v0-clone
3. ✅ Extract `GenerationThumbnails` from v0-clone
4. ✅ Create `ValidationPanel` (combine TaskPageClient)
5. ✅ Create `IterationHistory` sidebar
6. ✅ Create `TopBar` with mode toggle
7. ✅ Create `ModeLayout` wrapper

### Week 2: Build Mode
1. ✅ Create `/app/build/page.tsx`
2. ✅ Create `/app/api/build/route.ts`
3. ✅ Create `/app/api/build/refine/route.ts`
4. ✅ Create `/app/api/build/finalize/route.ts`
5. ✅ Integrate v0 SDK for generation
6. ✅ Test A/B/C generation flow
7. ✅ Test refinement flow
8. ✅ Test project creation

### Week 3: Features Mode Integration
1. ✅ Create `/app/features/page.tsx`
2. ✅ Move existing task sidebar to left
3. ✅ Integrate `ValidationPanel` in center
4. ✅ Integrate `LivePreview` on right
5. ✅ Add iteration history to right panel
6. ✅ Test full validation flow with UI
7. ✅ Test retry/rollback in UI

### Week 4: Polish & Testing
1. ✅ Responsive design for both modes
2. ✅ Loading states and error handling
3. ✅ Keyboard shortcuts (Cmd+K for mode toggle)
4. ✅ Animations and transitions
5. ✅ E2E tests for both modes
6. ✅ Documentation and user guide

---

## Key Design Decisions

### 1. **Agent Picker Placement**
- **Decision**: Inline with prompt input (like model selector)
- **Why**: User explicitly values agent picker, keep it prominent
- **Implementation**: Extend v0's PromptInput to include agent dropdown

### 2. **Preview Panel Position**
- **Decision**: Always on right (40% width)
- **Why**: Consistent with v0-clone, users expect preview on right
- **Implementation**: Fixed right panel in both modes

### 3. **Mode Toggle Location**
- **Decision**: Top center of top bar
- **Why**: Primary navigation, always visible
- **Implementation**: Prominent toggle button (not hidden in menu)

### 4. **Task Sidebar**
- **Decision**: Left sidebar, collapsible
- **Why**: Doesn't interfere with main workflow, easy access to history
- **Implementation**:
  - Build mode: Hidden by default (can show previous builds)
  - Features mode: Visible by default (shows all tasks)

### 5. **Validation in Build Mode**
- **Decision**: No Playwright tests in Build mode
- **Why**: Build mode is exploratory, validation adds friction
- **Implementation**: Validation only in Features mode

### 6. **Project Association**
- **Decision**: Build mode creates "project" entity, Features mode creates "tasks" within project
- **Why**: Clear separation of concerns, easier project management later
- **Implementation**: New `projects` table in database

---

## Database Schema Updates

```typescript
// lib/db/schema.ts - Add new table
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  repoUrl: text('repo_url'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Build mode data
  initialPrompt: text('initial_prompt'),
  selectedGenerationId: text('selected_generation_id'),
  buildAgent: text('build_agent'), // claude, codex, etc.
  buildModel: text('build_model'),
})

// Update tasks table to reference projects
export const tasks = pgTable('tasks', {
  // ... existing fields ...
  projectId: text('project_id').references(() => projects.id),
})
```

---

## Migration Path

### For Existing Users:

1. **First Load**: Show mode toggle, default to "Features" mode
2. **Existing tasks**: Continue to work as before
3. **Build mode**: New feature, optional to use
4. **No breaking changes**: All current functionality preserved

### For New Users:

1. **Onboarding**: Show both modes, suggest Build mode for new projects
2. **Tutorial**: Guide through Build → Features workflow
3. **Templates**: Pre-built project templates in Build mode

---

## Success Metrics

**Build Mode:**
- Time to create initial app scaffold: Target < 2 minutes
- User satisfaction with A/B/C variations: Target > 80% find one suitable
- Number of refinement iterations: Average 2-3

**Features Mode:**
- Test pass rate on first attempt: Target > 60%
- Average retries before success: Target < 2
- Time from prompt to validated feature: Target < 10 minutes

**Overall:**
- Mode switching frequency: Track user behavior
- User preference: Which mode is used more?
- Task completion rate: Features mode vs manual coding

---

## Next Steps

1. **Review this plan** - Confirm approach with user
2. **Start Phase 1** - Extract shared components from v0-clone
3. **Create component storybook** - Test components in isolation
4. **Build backend APIs** - `/api/build` endpoints
5. **Implement Build mode** - Full workflow
6. **Integrate Features mode** - Connect existing validation system
7. **User testing** - Get feedback on both modes
8. **Polish & deploy** - Production-ready

---

## Questions for User

1. ✅ **Confirmed**: Mode toggle in top bar (not separate apps)?
2. ✅ **Confirmed**: Keep task sidebar on left in Features mode?
3. ⏳ **Pending**: Should Build mode save to database or just session storage initially?
4. ⏳ **Pending**: Should we support "forking" a Build mode generation into Features mode for refinement?
5. ⏳ **Pending**: Preview panel width: Fixed 40% or user-adjustable?
6. ⏳ **Pending**: Should validation be optional in Features mode (toggle on/off)?

---

## Summary

This plan merges the best of both worlds:
- **v0-clone**: Beautiful chat interface, live preview, iterative refinement
- **Current platform**: Agent picker, task management, validation system, multi-agent support

**Build Mode** focuses on rapid prototyping with v0's UI generation.
**Features Mode** focuses on validated development with test-driven iteration.

Both modes share components for consistency and maintainability, while maintaining distinct workflows optimized for their use cases.
