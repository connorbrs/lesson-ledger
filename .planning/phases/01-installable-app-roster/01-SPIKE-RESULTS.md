# Phase 1 Device Spike Results

Date: 2026-10-18
Origin: https://connorbrs.github.io/lesson-ledger/
Source: raw Device check readings pasted by the user from inside the installed home-screen app, plus the user's confirmation that Parts A to D passed.

ios-version: 26.6.1
device-model: not reported (iPhone; model name not given)
safari-tab-persisted: not reported numerically (user reported Part A passed)
home-screen-persisted: true (persist() true, persisted() true)
home-screen-estimate: 231471 bytes used of 41231686042 bytes quota (about 0.23 MB of about 41 GB)
blob-roundtrip-safari: ok (user reported Part A passed)
blob-roundtrip-home-screen: ok (user reported all passed)
safari-tab-data: separate
offline-relaunch: ok (opened in Airplane Mode after force-quit; Home Test still listed)
icon: ok (Part B passed)
fullscreen: ok (navigator.standalone true, display-mode standalone true)

## Raw reading (installed home-screen app)

```
userAgent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1
navigator.standalone: true
display-mode standalone: true
persist(): true
persisted(): true
estimate() usage: 231471 quota: 41231686042
families count: 1
```

Note: the "OS 18_7" token in the user agent is the frozen iOS UA value that Safari reports. The real version is the Safari/iOS 26.6.1 (`Version/26.6.1`), which is why ios-version is 26.6.1. This satisfies the "iOS 18+" target from STATE.md.

Note: safari-tab-data is separate because the family "Safari Test" (added in the Safari tab) was NOT listed in the installed app, and the installed app's family count was 1 (only "Home Test").

## Implications

(a) safari-tab-data is separate, so Plan 04 may ship the UI-SPEC Safari-tab banner sentence about separate data as written.

(b) home-screen-persisted is true, so the persisted Settings footer state is the one that shows on this device. Phase 2 backup remains the protection against eviction regardless, because multi-day behavior is still unobserved (RESEARCH A7).

(c) No blocker. blob-roundtrip-home-screen is ok and offline-relaunch is ok, so Phase 1 and later plans that store receipt photos as Blobs in IndexedDB may proceed. The quota is large (about 41 GB) so receipt storage size is not a near-term concern on this device.

(d) Unrecorded items: device-model and a numeric safari-tab-persisted reading were not reported. Neither affects a later plan; append them under Follow-up if the user supplies them.

## Follow-up

APP-03 7-day-eviction question (RESEARCH A7): to be observed over several days after install. Append later readings of persisted() and estimate() here when the user sends them.
