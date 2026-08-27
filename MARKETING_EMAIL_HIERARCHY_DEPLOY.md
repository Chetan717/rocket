# Production checklist: Admin + Marketing hierarchy cutover

## 1. Protect credentials

The Gmail App Password shared in chat must be treated as exposed. Revoke it, create a replacement App Password, and store the replacement only with:

```bash
firebase functions:secrets:set EMAIL_PASS
```

Never place it in this ZIP, source, a frontend `VITE_` variable, or a committed `.env`. The server-side sender defaults to `soilbooster717@gmail.com`.

## 2. Deploy Admin first

Back up `mteam`, `couponcode`, `users` and `subscription`, then run from this Admin project:

```bash
cd functions
npm ci
cd ..
firebase deploy --only functions:panelListMarketingHierarchy,functions:panelUpsertMarketingMember,functions:panelDeleteMarketingMember,functions:panelUpsertMarketingCoupon,functions:panelDeleteMarketingCoupon,functions:panelDeletePushCampaigns
npm ci --legacy-peer-deps
npm test
npm run build
firebase deploy --only hosting
```

The new Admin UI writes hierarchy/coupon data only through trusted callables. Master Admin alone can delete; deletion is blocked when it would orphan a team or sales history.

## 3. Migrate Marketing records before email cutover

In **Marketing Hierarchy**, edit every active member and save:

- unique registered login email;
- parent member (blank for root);
- commission percentage;
- parent bonus percentage (default 10);
- status and profile mobile.

Configure roots first, then children. A child percentage may equal but cannot exceed its parent's percentage. In **Coupon Codes**, confirm one coupon per member and that the coupon percentage matches the member percentage.

Do not deploy the Marketing email-only frontend until every active member who needs access has a login email.

## 4. Deploy Marketing email OTP and My Team

Use `SECURITY_DEPLOY.md` in the Marketing package. Deploy its named callables so the existing Marketing OTP callable IDs overwrite the SMS implementation, then deploy Marketing hosting.

## 5. Production smoke test

- Admin notification history: select multiple, delete selected, and Clear All.
- Marketing login: registered email only, 6-digit OTP, no mobile/SMS input.
- Root dashboard: existing users/sales/commission remain unchanged.
- Child dashboard: own coupon users and commission only; parent name and assigned percentage visible.
- Parent My Team: only direct assigned members; accurate totals and team bonus.
- Child coupon detail: search/date/status/profile/company filters work and no mobile/password is returned or displayed.
- Admin-only mutation: Marketing member cannot change hierarchy, assignment or percentage.

Merge `MARKETING_HIERARCHY_RULES_UPDATE.md` into the existing production Firestore rules. Do not overwrite unrelated rules.
