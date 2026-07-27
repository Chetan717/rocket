# Task Management setup

Task Management uses the Firestore collection `Taskm` directly. No new task-writing Cloud Function is required.

Apply `TASK_MANAGEMENT_RULES_UPDATE.md` to the project's existing Firestore rules before deploying the updated panels. The role-based query does not require a new composite index.

The existing Admin login Cloud Function creates the `tabs` claim used by the
sidebar and Firestore rules. This package includes the corrected
`functions/index.js`, whose secure allowlist now contains `taskmanagement`.
Deploy the included functions once after installing their dependencies:

```bash
cd functions
npm ci
cd ..
firebase deploy --only functions
```

The collection name defaults to `Taskm`. If this project uses collection-name environment variables, this optional value is supported:

```env
VITE_COL_TASKM=Taskm
```

## Document fields

- `name`: required task name
- `taskDate`: required `YYYY-MM-DD` date
- `description`: required description
- `companyName`: optional string (saved as an empty string when omitted)
- `status`: `Initiated`, `Working`, `Pending`, or `Completed`
- `assignedRole`: `Master Admin`, `Admin`, `Developer`, `Template Uploader`, or `Designer`
- `assignedRoleKey`: canonical role key used by the secure Admin query
- `assignedPanel`: always `admin`
- `createdByPanel`: `marketing` for Marketing-created tasks or `admin` for Admin-created tasks
- `createdByMteamId`: Marketing team ID for Marketing-created tasks; empty string for Admin-created tasks
- `createdByUid`, `createdByName`, `createdByRole`: creator identity and audit fields
- `createdAt`, `updatedAt`: server timestamps
- `updatedByUid`, `updatedByName`, `updatedByPanel`: last-update audit fields

## Admin permission and visibility

Master Admin can assign `Task Management` from Admin Management and sees all
tasks. Every supported Admin user with the `Task Management` tab gets an
`Add Task` option with role selection. Non-Master Admin users see tasks assigned
to their exact role plus every task they personally created, including tasks
they assigned to another Admin role. The page merges both real-time queries and
removes duplicates, so a task created for the creator's own role appears once.

After a role or tab change, the assigned Admin User must fully **Logout** and
then log in again. The new login token will contain `taskmanagement`; refreshing
the browser alone cannot replace an already-issued permission token.
