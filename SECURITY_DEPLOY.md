# Secure OTP panel deployment

1. Firebase Phone Auth is not used. OTP is delivered only through the server-side 2Factor.in account.
2. Ensure exactly one active `adminuser` document has the owner's 10-digit `mobile` and role `Master Admin`.
3. Install the CLI and authenticate: `npm i -g firebase-tools` then `firebase login`.
4. Select the project: `firebase use --add`.
5. Install backend dependencies: `cd functions && npm install && cd ..`.
6. The existing server secret `TWOFACTOR_API_KEY` is used. Never add it to a `VITE_` variable.
7. Manually merge the supplied rule blocks into production; do not overwrite your existing rules/indexes.
8. Deploy only this panel's named callables: `firebase deploy --only functions:panelStartTwoFactorOtp,functions:panelVerifyTwoFactorOtp,functions:panelCreateSessionFromTwoFactor,functions:panelLogout,functions:purgeLegacyPanelSecrets`.
9. Add all `.env.example` values to the frontend host, then run `npm install --legacy-peer-deps && npm run build`.
10. On the owner's first successful OTP login, legacy admin PINs and embedded marketing passwords are purged and legacy admin sub-users are linked to that owner.

Sub-users never request their own OTP. The owner verifies OTP and then chooses an active delegated account. Panel credentials use in-memory persistence, so refresh/close requires OTP again.
