# Firestore rules update for Admin-managed Marketing hierarchy

`mteam` hierarchy/login fields and `couponcode` are now mutated only through Admin Cloud Functions using Admin SDK. Remove any browser rule that lets an Admin or Marketing client directly create/delete Marketing members or coupons.

The Marketing package contains the detailed rule snippet. Its required behavior is:

- a Marketing session may read only its own `mteam` document;
- an owner may update only the legacy `team` and `updatedAt` fields used for Portal Users;
- Marketing clients cannot write `loginEmail`, `parentMteamId`, `ancestorIds`, `level`, `commissionPercentage`, `uplineBonusPercentage`, `assign_coupon_id` or `referCode`;
- Marketing clients cannot create/update/delete coupons;
- a member's own coupon may remain readable for its own dashboard;
- a parent receives child summaries and sanitized child users only through `marketingGetMyTeam` and `marketingGetTeamMemberLeads`.

Merge these restrictions into the current rules rather than replacing the complete production rule set. Cloud Functions do not need an `allow` rule because they use Admin SDK.
