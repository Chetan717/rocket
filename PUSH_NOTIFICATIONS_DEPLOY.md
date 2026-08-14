# Push Notifications deployment

1. Expo dashboard में Enhanced Push Security enable करके access token बनाएँ।
2. Firebase CLI login करें: `firebase login`.
3. `firebase functions:secrets:set EXPO_ACCESS_TOKEN`
4. `firebase deploy --only functions`
5. `npm run build && firebase deploy --only hosting`
6. App registration endpoint: `https://asia-south1-mlmbooster-a4887.cloudfunctions.net/registerExpoPushToken`

Send केवल authenticated Master Admin कर सकता है।
