# Template Storage Cleanup

The `cleanupTemplateStorageOnWrite` backend trigger now handles every saved
Template delete flow:

- deleting one Graphics Link row;
- clearing or replacing any uploaded Template image/video URL;
- deleting a complete MLM or General Template;
- deleting through any Admin role or future UI that writes `mlmtemplate`.

Only Firebase Storage objects in this project's `templates/` folder are
eligible. External URLs and other folders/buckets are ignored. If another
Template still references the same object, it is retained.

## Deploy

This trigger is deployed in `us-central1`. Existing Admin authentication
Functions remain in their current region and are not migrated by this change.

From the project root run:

```bash
cd functions
npm ci
cd ..
firebase deploy --only functions:cleanupTemplateStorageOnWrite
```

Deploy the Function before testing. No Firestore Rules, Storage Rules, index,
or frontend deployment is required for this backend cleanup change.

## Verify

1. Edit a Template and delete one Graphics Link that contains uploaded files.
2. Save the Template.
3. Confirm the Firestore row is gone.
4. Confirm its unreferenced files are gone from Firebase Storage.
5. Delete a complete Template and confirm its remaining `templates/...` files
   are removed too.

Cleanup runs asynchronously after Firestore accepts the save/delete, so the
Storage objects can take a few seconds to disappear.
