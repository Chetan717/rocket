# Firestore Task Management rule update

This feature still writes directly to the `Taskm` collection. It does not need a
new task-writing Cloud Function. The existing Admin login functions must still
be deployed from this package so the login token allowlist includes
`taskmanagement`.

In the existing Firestore rules, replace the old `marketingTaskAccess()`, `validTask()` and `match /Taskm/{taskId}` blocks with the blocks below. Keep the project's other collection rules unchanged.

```js
function marketingTaskAccess() {
  return marketingOwner() || marketingTab('taskmanagement');
}

function adminTaskRoleKey() {
  return request.auth.token.role == 'Master Admin' ? 'master_admin'
    : request.auth.token.role == 'Admin' ? 'admin'
    : request.auth.token.role == 'Developer' ? 'developer'
    : request.auth.token.role == 'Devloper' ? 'developer'
    : request.auth.token.role == 'Template Uploader' ? 'template_uploader'
    : request.auth.token.role == 'Designer' ? 'designer'
    : '';
}

function validTaskRole(data) {
  return (data.assignedRoleKey == 'master_admin' && data.assignedRole == 'Master Admin')
    || (data.assignedRoleKey == 'admin' && data.assignedRole == 'Admin')
    || (data.assignedRoleKey == 'developer' && data.assignedRole == 'Developer')
    || (data.assignedRoleKey == 'template_uploader' && data.assignedRole == 'Template Uploader')
    || (data.assignedRoleKey == 'designer' && data.assignedRole == 'Designer');
}

function validTask(data) {
  return data.name is string
    && data.name.size() > 0
    && data.name.size() <= 120
    && data.taskDate is string
    && data.taskDate.size() == 10
    && data.description is string
    && data.description.size() > 0
    && data.description.size() <= 2000
    && data.companyName is string
    && data.companyName.size() <= 150
    && data.status in ['Initiated', 'Working', 'Pending', 'Completed']
    && data.assignedPanel == 'admin'
    && validTaskRole(data);
}

function adminTaskAccess(data) {
  return adminTab('taskmanagement')
    && (
      request.auth.token.role == 'Master Admin'
      || (
        adminTaskRoleKey() != ''
        && (
          data.assignedRoleKey == adminTaskRoleKey()
          || data.createdByUid == request.auth.uid
        )
      )
    );
}

function validAdminTaskCreator(data) {
  return adminTab('taskmanagement')
    && adminTaskRoleKey() != ''
    && data.createdByMteamId == ''
    && data.createdByUid == request.auth.uid
    && data.createdByName == request.auth.token.name
    && data.createdByPanel == 'admin'
    && (
      (
        adminTaskRoleKey() == 'master_admin'
        && data.createdByRole == 'Master Admin'
      )
      || (
        adminTaskRoleKey() == 'admin'
        && data.createdByRole == 'Admin'
      )
      || (
        adminTaskRoleKey() == 'developer'
        && data.createdByRole == 'Developer'
      )
      || (
        adminTaskRoleKey() == 'template_uploader'
        && data.createdByRole == 'Template Uploader'
      )
      || (
        adminTaskRoleKey() == 'designer'
        && data.createdByRole == 'Designer'
      )
    );
}

match /Taskm/{taskId} {
  allow read: if adminTaskAccess(resource.data)
    || (
      marketingTaskAccess()
      && resource.data.createdByMteamId == request.auth.token.mteamId
    );

  allow create: if validTask(request.resource.data)
    && (
      (
        marketingTaskAccess()
        && request.resource.data.createdByMteamId == request.auth.token.mteamId
        && request.resource.data.createdByUid == request.auth.uid
        && request.resource.data.createdByPanel == 'marketing'
      )
      || (
        validAdminTaskCreator(request.resource.data)
      )
    );

  allow update: if validTask(request.resource.data)
    && request.resource.data.createdByMteamId == resource.data.createdByMteamId
    && request.resource.data.createdByUid == resource.data.createdByUid
    && request.resource.data.createdByPanel == resource.data.createdByPanel
    && request.resource.data.assignedPanel == resource.data.assignedPanel
    && (
      (
        marketingTaskAccess()
        && resource.data.createdByMteamId == request.auth.token.mteamId
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'name',
          'taskDate',
          'description',
          'companyName',
          'status',
          'assignedRole',
          'assignedRoleKey',
          'updatedAt',
          'updatedByUid',
          'updatedByName',
          'updatedByPanel'
        ])
      )
      || (
        adminTaskAccess(resource.data)
        && (
          (
            request.auth.token.role == 'Master Admin'
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
              'name',
              'taskDate',
              'description',
              'companyName',
              'status',
              'assignedRole',
              'assignedRoleKey',
              'updatedAt',
              'updatedByUid',
              'updatedByName',
              'updatedByPanel'
            ])
          )
          || (
            request.resource.data.assignedRole == resource.data.assignedRole
            && request.resource.data.assignedRoleKey == resource.data.assignedRoleKey
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
              'name',
              'taskDate',
              'description',
              'companyName',
              'status',
              'updatedAt',
              'updatedByUid',
              'updatedByName',
              'updatedByPanel'
            ])
          )
        )
      )
    );

  allow delete: if adminTaskAccess(resource.data)
    || (
      marketingTaskAccess()
      && resource.data.createdByMteamId == request.auth.token.mteamId
    );
}
```

No new composite index is required for the role query. Every supported Admin
user who has the `Task Management` tab can create a task directly from the Admin
Task Management page and assign it to any supported Admin role. Master Admin
continues to see all tasks; other Admin users see both tasks assigned to their
exact role and every task they personally created, even when they assigned that
task to a different role. Existing tasks without
`assignedRole` and `assignedRoleKey` remain visible to Master Admin; open and
save each old task once in Marketing or as Master Admin to assign its role.

After publishing these rules and deploying the included functions, affected
Admin Users must fully logout and login once. A browser refresh alone keeps the
old token claims.
