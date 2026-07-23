# Task Management setup
bhbhbjb
Task Management uses the Firestore collection `Taskm` directly. No new Cloud Function is required.

## Required deployment

Deploy the included Firestore rules and indexes after both panels are deployed:

```bash
firebase deploy --only firestore:rules,firestore:indexes
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
- `status`: `Initiated`, `Pending`, or `Completed`
- `assignedPanel`: always `admin`
- `createdByPanel`: always `marketing`
- `createdByMteamId`, `createdByUid`, `createdByName`: marketing ownership/audit fields
- `createdAt`, `updatedAt`: server timestamps
- `updatedByUid`, `updatedByName`, `updatedByPanel`: last-update audit fields

## Admin permission

Master Admin can assign `Task Management` from Admin Management. The assigned sub-admin must sign in again or refresh their auth token if the existing authentication system stores tab permissions in custom claims.
