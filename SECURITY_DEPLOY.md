# Secure Admin email OTP deployment

## What changed

- Admin login no longer asks for or sends an OTP to a mobile number.
- Nodemailer sends a 6-digit OTP through Gmail SMTP.
- Every Admin login OTP goes only to the fixed recipient `mlmliveapp@gmail.com`.
- The SMTP sender is `soilbooster717@gmail.com`.
- Existing Admin account selection, strong passwords, roles/tabs, sessions and login activity remain unchanged.
- The old callable IDs are intentionally retained so deployment overwrites and disables the previously deployed SMS implementation.

## Secret setup

Never place the Gmail App Password in source code, a frontend variable, `.env` committed to the project, or this ZIP. Store it as a Firebase Secret:

```bash
firebase functions:secrets:set EMAIL_PASS
```

When prompted, enter the Gmail App Password. `EMAIL_NODEMAILER` defaults to `soilbooster717@gmail.com` in the backend parameter configuration.

The Gmail sender account must have 2-Step Verification enabled and the credential must be an App Password, not the normal Gmail password.

## Deploy

From the project root:

```bash
cd functions
npm ci
cd ..
firebase deploy --only functions:panelStartTwoFactorOtp,functions:panelVerifyTwoFactorOtp,functions:panelCreateSessionFromTwoFactor
npm install --legacy-peer-deps
npm run build
firebase deploy --only hosting
```

Deploying the three named Functions is required. It replaces the old SMS code at the same endpoints, so `TWOFACTOR_API_KEY` is no longer read and Admin SMS OTP charges stop.

## Expected login flow

1. Open Admin login and click **Send Email OTP**.
2. A 6-digit OTP is sent to the fixed Admin mailbox.
3. Verify it within 5 minutes.
4. Select the active Admin account and enter its strong password.
5. Refresh uses the existing password unlock flow; it does not send another OTP.

Exactly one active `adminuser` document must have role `Master Admin`. OTP resend has a 60-second cooldown, is limited to 3 sends per 10 minutes, and verification allows at most 5 incorrect attempts.
