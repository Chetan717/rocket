# Firestore Task Management rule update

This feature still writes directly to the `Taskm` collection. It does not need a new Cloud Function.

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
        && data.assignedRoleKey == adminTaskRoleKey()
      )
    );
}

match /Taskm/{taskId} {
  allow read: if adminTaskAccess(resource.data)
    || (
      marketingTaskAccess()
      && resource.data.createdByMteamId == request.auth.token.mteamId
    );

  allow create: if marketingTaskAccess()
    && validTask(request.resource.data)
    && request.resource.data.createdByMteamId == request.auth.token.mteamId
    && request.resource.data.createdByUid == request.auth.uid
    && request.resource.data.createdByPanel == 'marketing';

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

No new composite index is required for the role query. Existing tasks without `assignedRole` and `assignedRoleKey` remain visible to Master Admin; open and save each old task once in Marketing or as Master Admin to assign its role.
