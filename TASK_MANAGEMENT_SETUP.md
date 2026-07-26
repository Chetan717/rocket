# Task Management setup

Task Management uses the Firestore collection `Taskm` directly. No new Cloud Function is required.

Apply `TASK_MANAGEMENT_RULES_UPDATE.md` to the project's existing Firestore rules before deploying the updated panels. The role-based query does not require a new composite index.

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
- `createdByPanel`: always `marketing`
- `createdByMteamId`, `createdByUid`, `createdByName`: marketing ownership/audit fields
- `createdAt`, `updatedAt`: server timestamps
- `updatedByUid`, `updatedByName`, `updatedByPanel`: last-update audit fields

## Admin permission and visibility

Master Admin can assign `Task Management` from Admin Management. Master Admin sees all tasks; other users only see tasks assigned to their exact role. The assigned user must sign in again after a role or tab change so the latest role and tab claims are loaded.
