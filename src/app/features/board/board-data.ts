export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'done';
  // ISO 'YYYY-MM-DD', matching <input type="date">'s value format directly. Empty string means
  // "no due date set" — kept as a string rather than null so the form's FormBuilder.nonNullable
  // group can manage it like every other field, with no separate null-handling branch.
  dueDate: string;
  subtasks: Subtask[];
}

// Seed data for the mock API (core/api/mock-api.db.ts) and for specs — the app itself never reads
// it directly; it loads boards and tasks over HttpClient. The keys double as the seeded board ids.
export const BOARD_TASKS: Record<string, Task[]> = {
  'platform-launch': [
    {
      id: 'define-scope',
      title: 'Define MVP scope',
      description: 'Draft and agree the MVP feature list with stakeholders.',
      status: 'done',
      dueDate: '2026-08-10',
      subtasks: [
        { id: 'define-scope-1', title: 'Interview stakeholders', completed: true },
        { id: 'define-scope-2', title: 'Draft feature list', completed: true },
        { id: 'define-scope-3', title: 'Get sign-off', completed: true },
      ],
    },
    {
      id: 'design-review',
      title: 'Design review',
      description: 'Walk through the high-fidelity mockups with design and engineering.',
      status: 'doing',
      dueDate: '2026-08-29',
      subtasks: [
        { id: 'design-review-1', title: 'Share Figma link with the team', completed: true },
        { id: 'design-review-2', title: 'Collect written feedback', completed: false },
        { id: 'design-review-3', title: 'Walkthrough meeting', completed: false },
      ],
    },
    {
      id: 'write-docs',
      title: 'Write launch docs',
      description: 'Write the public launch announcement and changelog.',
      status: 'todo',
      dueDate: '2026-09-05',
      subtasks: [],
    },
    {
      id: 'beta-testing',
      title: 'Run beta testing',
      description: 'Recruit beta users and collect structured feedback before GA.',
      status: 'doing',
      dueDate: '2026-09-12',
      subtasks: [
        { id: 'beta-testing-1', title: 'Recruit beta cohort', completed: true },
        { id: 'beta-testing-2', title: 'Send onboarding instructions', completed: true },
        { id: 'beta-testing-3', title: 'Collect feedback survey', completed: false },
      ],
    },
    {
      id: 'qa-signoff',
      title: 'QA sign-off',
      description: 'Run the full regression suite and get QA sign-off before release.',
      status: 'todo',
      dueDate: '2026-09-18',
      subtasks: [
        { id: 'qa-signoff-1', title: 'Run regression suite', completed: false },
        { id: 'qa-signoff-2', title: 'Log and triage bugs', completed: false },
      ],
    },
    {
      id: 'press-kit',
      title: 'Prepare press kit',
      description: 'Assemble screenshots, logos and boilerplate for press outreach.',
      status: 'todo',
      dueDate: '2026-09-22',
      subtasks: [],
    },
  ],
  'marketing-plan': [
    {
      id: 'audience-research',
      title: 'Audience research',
      description: 'Identify target segments and messaging angles.',
      status: 'done',
      dueDate: '2026-07-20',
      subtasks: [],
    },
    {
      id: 'draft-campaign',
      title: 'Draft campaign copy',
      description: 'Write first-draft copy for the launch campaign.',
      status: 'todo',
      dueDate: '2026-09-01',
      subtasks: [],
    },
    {
      id: 'schedule-posts',
      title: 'Schedule social posts',
      description: 'Queue social posts across all channels for launch week.',
      status: 'todo',
      dueDate: '2026-09-10',
      subtasks: [],
    },
    {
      id: 'influencer-outreach',
      title: 'Influencer outreach',
      description: 'Shortlist and contact relevant influencers for launch week.',
      status: 'doing',
      dueDate: '2026-09-08',
      subtasks: [
        { id: 'influencer-outreach-1', title: 'Shortlist influencers', completed: true },
        { id: 'influencer-outreach-2', title: 'Send outreach emails', completed: false },
      ],
    },
    {
      id: 'design-ad-creatives',
      title: 'Design ad creatives',
      description: 'Produce banner and social ad creatives for the campaign.',
      status: 'todo',
      dueDate: '2026-09-14',
      subtasks: [],
    },
    {
      id: 'launch-email-blast',
      title: 'Send launch email blast',
      description: 'Prepare and schedule the launch-day email to the mailing list.',
      status: 'todo',
      dueDate: '2026-09-16',
      subtasks: [],
    },
  ],
  roadmap: [
    {
      id: 'q1-goals',
      title: 'Set Q1 goals',
      description: 'Set and align on Q1 OKRs across teams.',
      status: 'doing',
      dueDate: '2026-09-15',
      subtasks: [
        { id: 'q1-goals-1', title: 'Review last quarter results', completed: true },
        { id: 'q1-goals-2', title: 'Draft OKRs', completed: false },
      ],
    },
    {
      id: 'prioritize-features',
      title: 'Prioritize features',
      description: 'Rank the backlog against Q1 goals.',
      status: 'todo',
      dueDate: '2026-09-20',
      subtasks: [],
    },
    {
      id: 'q2-goals',
      title: 'Set Q2 goals',
      description: 'Set and align on Q2 OKRs across teams based on Q1 outcomes.',
      status: 'todo',
      dueDate: '2026-12-15',
      subtasks: [
        { id: 'q2-goals-1', title: 'Review Q1 outcomes', completed: false },
        { id: 'q2-goals-2', title: 'Draft Q2 OKRs', completed: false },
      ],
    },
    {
      id: 'review-roadmap-risks',
      title: 'Review roadmap risks',
      description: 'Identify dependencies and risks across the prioritized roadmap.',
      status: 'todo',
      dueDate: '2026-09-25',
      subtasks: [],
    },
  ],
};

export const BOARD_IDS = Object.keys(BOARD_TASKS);
