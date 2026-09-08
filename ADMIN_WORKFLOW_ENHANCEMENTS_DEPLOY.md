# Admin workflow enhancements — deploy notes

Implemented:
1. Quality Check: one-click marks every current Graphics Link as `OK`; user still clicks Save Quality Check to persist.
2. Task email notifications:
   - New task -> active Admin users matching the assigned role, with `taskmanagement` access and a valid Admin Management email.
   - Transition to `Completed` -> same assigned recipients + Master Admin.
   - Master Admin email falls back to the existing secure admin mailbox if the Master Admin profile has no email.
3. Template / Company delete approval:
   - Sub-user delete creates a backend approval request instead of deleting.
   - Master Admin sees `Delete Requests` in the sidebar.
   - Master can Cancel or `Approve & Open`.
   - Approved request redirects to the original Template/Company edit page.
   - Final delete is performed there by Master Admin through a Master-only callable and request is marked `deleted`.

## Before testing task mail
Open **Admin Management** and set `Email for Task Notifications` for each active task recipient. Existing users without an email continue to work normally but cannot receive task email until an email is saved.

The project already uses the `EMAIL_PASS` secret / `EMAIL_NODEMAILER` configuration for Admin email OTP. The task notification trigger reuses the same mail configuration.

## Deploy Cloud Functions
From the project root:

```bash
firebase use mlmbooster-a4887
cd functions
npm install
cd ..
firebase deploy --only functions:taskEmailNotifications,functions:panelCreateDeleteRequest,functions:panelListDeleteRequests,functions:panelReviewDeleteRequest,functions:panelFinalizeApprovedDelete
```

If `EMAIL_PASS` has not been configured in this Firebase project, configure it using the same secret already required by the Admin email OTP function before deploying the task trigger.

## Deploy Admin frontend
Use the same existing production frontend deployment process for this Admin project. No Firestore client-rule expansion is required for the new delete-request records because create/review/final-delete operations are handled by authenticated Cloud Functions.

## Verification checklist
- Quality Check -> click `One Click: All Graphics OK` -> all rows become OK -> Save -> reopen and verify.
- Add a task assigned to a role whose active Admin user has taskmanagement access + email -> verify assignment email.
- Change the task to Completed -> verify assigned user(s) + Master Admin receive details.
- Login as sub-user with Template operation access -> Delete Template -> request is sent, item remains.
- Login as Master Admin -> Delete Requests -> Approve & Open -> final Delete Template -> item is removed and request becomes deleted.
- Repeat the same flow for Company.
