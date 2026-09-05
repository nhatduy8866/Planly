# Planly

Planly is a personal planning application that brings schedules and to-do lists into one focused workspace. It helps users decide what to do, reserve time for it, and track progress without switching between separate task and calendar tools.

> This document defines the initial product scope. Technical architecture and implementation details will be added after the product requirements are validated.

## Product Vision

People often keep tasks in one tool and appointments in another. This makes it difficult to understand whether a plan is realistic, which work is most important, and what should happen next. Planly connects tasks with time so users can turn a list of intentions into an actionable daily schedule.

Planly should make it easy to:

- Capture work before it is forgotten.
- Organize tasks by project, priority, status, and date.
- Schedule tasks alongside fixed calendar events.
- See a clear daily, weekly, and monthly plan.
- Adjust plans quickly when priorities or availability change.
- Review completed and overdue work.

## Target Users

The first version is designed for individual users, including:

- Students managing classes, assignments, exams, and personal commitments.
- Professionals organizing focused work, meetings, and deadlines.
- Freelancers balancing tasks and schedules across multiple projects.
- Anyone who wants a lightweight personal planning system.

Team-based planning and enterprise workflows are not part of the initial release.

## Product Goals

1. Provide one reliable place for personal tasks and scheduled activities.
2. Reduce the effort required to plan a day or week.
3. Make priorities, deadlines, and schedule conflicts visible.
4. Support fast rescheduling without losing task context.
5. Give users a simple view of progress and unfinished work.

## Product Assumptions

- Planly is a responsive, web-first application.
- Each account represents one individual user.
- A user has one primary time zone, with dates stored consistently to avoid scheduling errors.
- Tasks may exist without a scheduled time; calendar events always have a defined time range.
- The MVP prioritizes a clear planning workflow over advanced automation and customization.

## MVP Scope

### 1. User Accounts and Preferences

- Register, sign in, sign out, and maintain a secure session.
- Reset a forgotten password.
- Edit basic profile information.
- Configure time zone, week-start day, date format, and notification preferences.
- Keep each user's planning data private and isolated.

### 2. Task Management

- Create, view, edit, complete, reopen, and delete tasks.
- Store a title, description, status, priority, due date, scheduled time, estimated duration, and notes.
- Use the following initial statuses: `To Do`, `In Progress`, and `Done`.
- Use the following initial priorities: `Low`, `Medium`, `High`, and `Urgent`.
- Add subtasks or checklist items to break down larger work.
- Assign tags for flexible categorization.
- Move unfinished tasks to another date without recreating them.
- Identify overdue tasks clearly.

### 3. Projects and Lists

- Group related tasks into projects.
- Create, rename, archive, and restore projects.
- Give a project a name, description, color, and optional target date.
- View project progress based on completed and remaining tasks.
- Keep an Inbox for tasks that have not yet been organized.

### 4. Scheduling and Calendar

- View scheduled tasks and events in daily, weekly, and monthly layouts.
- Create, edit, move, resize, and delete calendar events.
- Schedule a task by assigning it a start time and duration.
- Reschedule items through direct manipulation where the interface supports it.
- Detect overlapping scheduled items and show a visible conflict warning.
- Preserve unscheduled tasks in a backlog that can be planned later.
- Navigate directly to today or to a selected date.

### 5. Planning Views

- **Today:** today's tasks, events, overdue work, and completion progress.
- **Upcoming:** work and events grouped by future date.
- **Calendar:** time-based daily, weekly, and monthly planning.
- **Inbox:** newly captured and unorganized tasks.
- **Project:** tasks and progress for a selected project.
- **Completed:** recently completed work for review.

### 6. Search, Filter, and Sort

- Search tasks by title and description.
- Filter by status, priority, project, tag, due date, and completion state.
- Sort by due date, scheduled time, priority, creation date, or title.
- Combine common filters to create a focused working view.

### 7. Reminders and Feedback

- Set an optional reminder for a task or event.
- Show in-app feedback when an item becomes due or overdue.
- Display clear success and error states for user actions.
- Ask for confirmation before destructive actions when recovery is not available.

### 8. Data and State Management

- Persist account, project, task, event, tag, and preference data.
- Keep task status and calendar placement consistent across views.
- Validate required fields and invalid date ranges.
- Record creation and last-updated timestamps for core entities.
- Support soft deletion or another recovery mechanism for important user data where practical.

## Core User Workflows

### Capture and organize a task

1. The user quickly adds a task to the Inbox.
2. The user optionally adds details, priority, due date, tags, and a project.
3. The task appears in all views that match its properties.

### Plan a day

1. The user opens the Today or Calendar view.
2. The user reviews fixed events, overdue tasks, and unscheduled work.
3. The user assigns time slots to selected tasks.
4. Planly warns about schedule conflicts.
5. The user confirms a realistic plan for the day.

### Complete and review work

1. The user marks a task or subtask as complete.
2. Planly updates project and daily progress immediately.
3. Completed work remains available in history for later review.

### Reschedule unfinished work

1. The user identifies an incomplete or overdue task.
2. The user moves it to a new date or time.
3. Planly updates every relevant planning view and retains the task's existing details.

## Functional Requirements

- **FR-01:** A user can manage tasks throughout their full lifecycle.
- **FR-02:** A user can organize tasks into projects and tag them.
- **FR-03:** A user can keep tasks unscheduled or place them into calendar time slots.
- **FR-04:** A user can manage non-task calendar events.
- **FR-05:** The system shows consistent information across task and calendar views.
- **FR-06:** The system detects invalid schedules and overlapping items.
- **FR-07:** A user can find relevant work through search, filters, and sorting.
- **FR-08:** A user can review overdue, upcoming, and completed work.
- **FR-09:** A user can configure regional and notification preferences.
- **FR-10:** The system prevents one user from accessing another user's private data.

## Non-Functional Requirements

- **Usability:** Common actions such as task capture, completion, and rescheduling should require minimal interaction.
- **Responsiveness:** Core workflows must work on desktop, tablet, and mobile screen sizes.
- **Performance:** Common planning views should become usable within two seconds under normal operating conditions.
- **Accessibility:** Interfaces should target WCAG 2.1 AA, including keyboard navigation, visible focus states, semantic labels, and adequate color contrast.
- **Security:** Credentials and sessions must be handled securely; authorization must be enforced for every protected resource.
- **Privacy:** Only necessary personal data should be collected, stored, and exposed.
- **Reliability:** Changes to tasks and schedules should not be silently lost or duplicated.
- **Maintainability:** Business rules should be separated from presentation concerns and covered by automated tests.
- **Observability:** Production errors and important system failures should be logged without exposing sensitive user data.

## Core Domain Model

| Entity | Purpose | Key relationships |
| --- | --- | --- |
| User | Owns private planning data and preferences | Has many projects, tasks, events, and tags |
| Project | Groups related tasks around an outcome | Belongs to a user and has many tasks |
| Task | Represents an actionable unit of work | Belongs to a user; may belong to a project and have tags/subtasks |
| Subtask | Represents a smaller step within a task | Belongs to one parent task |
| Event | Represents a fixed calendar commitment | Belongs to a user and occupies a time range |
| Tag | Provides flexible task categorization | Belongs to a user and may be assigned to many tasks |
| Reminder | Triggers time-based feedback | Belongs to a task or event |
| Preference | Stores user-specific planning settings | Belongs to one user |

## Out of Scope for the MVP

The following capabilities are intentionally deferred:

- Shared workspaces, team projects, task assignment, and role-based collaboration.
- Real-time collaborative editing, comments, chat, and mentions.
- External calendar synchronization with Google Calendar, Outlook, or Apple Calendar.
- Import and export from third-party task-management products.
- AI-generated plans, automatic prioritization, and schedule optimization.
- Billing, subscriptions, invoicing, and time tracking for clients.
- Complex workflow automation and user-defined status pipelines.
- Native desktop, iOS, Android, or wearable applications.
- Offline-first synchronization across multiple devices.
- File attachments and large document storage.

These items may be reconsidered after the MVP is validated with real users.

## Delivery Roadmap

### Phase 1: Foundation

- Confirm product requirements and interaction flows.
- Select the technical stack and define the application architecture.
- Establish authentication, persistence, validation, testing, and deployment foundations.

### Phase 2: Task Organization

- Deliver the Inbox, task lifecycle, projects, tags, subtasks, filters, and search.
- Validate task-management workflows with representative users.

### Phase 3: Scheduling

- Deliver Today, Upcoming, and Calendar views.
- Add time blocking, event management, rescheduling, and conflict feedback.

### Phase 4: Readiness and Release

- Add reminders, preferences, accessibility improvements, error handling, and observability.
- Complete security, performance, usability, and cross-device testing.
- Prepare production deployment and MVP release documentation.

## MVP Success Criteria

The MVP is considered product-ready when a user can:

- Create an account and securely access private planning data.
- Capture, organize, schedule, complete, and reschedule tasks.
- Manage calendar events and recognize scheduling conflicts.
- Understand today's priorities and upcoming commitments at a glance.
- Use all core workflows on both desktop and mobile layouts.
- Return later and find saved data accurate and consistent.

Product validation should also measure task completion rate, weekly planning activity, overdue-task recovery, schedule changes, and user-reported planning clarity.

## Repository Status

Planly is currently in the product-definition stage. The repository contains the agreed scope baseline; application code, architecture decisions, development setup, and contribution guidelines will be added as implementation begins.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the repository owner.
