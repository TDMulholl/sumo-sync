# How it works

## Video position is a clock time

Abema's live player uses MPEG-DASH. The stream manifest (`.mpd` file) sets:

```
availabilityStartTime="1970-01-01T00:00:00.000Z"
```

That makes the video timeline start at the Unix epoch, so `video.currentTime`
is the clock time (UTC, in seconds) stamped on the frame being shown.

Example from a player report taken 2026-11-14:

- `currentTime` = `1794625361.66` = 03:02:41.66 UTC
- Report made at 03:03:04.5 UTC (PC clock), so about 22.8 s behind real time

## How the player works out the position

Each segment's position comes from the manifest:

```
position = Period start + (segment time - presentationTimeOffset) / timescale
```

Worked example from the same report:

| Value | Number |
|---|---|
| Period start | `PT1794624814.820000S` (02:53:34 UTC) |
| presentationTimeOffset | `5260539960` |
| timescale | `90000` |
| Segment file | `5310464850.m4s` |
| Result | 1794624814.82 + (5310464850 - 5260539960) / 90000 = 1794625369.54 (03:02:49.5 UTC) |

## Why position is the only value needed for sync

Every frame has one fixed position. Two players showing the same position are
showing the same frame, so:

> same position = same frame = in sync

Things that differ between viewers change when a frame arrives, not the
position stamped on the frame:

| Difference | Changes | Changes the position? |
|---|---|---|
| VPN or CDN server | When the frame arrives | No |
| Joining late | Which frames are seen first | No |
| Pausing or buffering | When the frame is watched | No |
| Twitch delay | When the streamer's picture arrives | No |
| Wrong PC clock | "Behind real time" figure | No |

The only other value needed is when the streamer's position was read, since the
position goes up by one second every second. Reading the position from the
streamer's Twitch picture includes the Twitch delay automatically.

## Other stream details

From the same manifest:

| Setting | Value | Meaning |
|---|---|---|
| `suggestedPresentationDelay` | 15 s | Player plays about 15 s behind the newest segment |
| `timeShiftBufferDepth` | 60 s | Only about 60 s can be rewound |
| Segment length | 360360 / 90000 = 4.004 s | Video arrives in pieces of about 4 s |
| `minimumUpdatePeriod` | 5 s | Manifest refreshed about every 5 s |
| `yospace.com` in manifest URL | - | Ads inserted on the server side |

No times are shown as text in Abema's player controls, so the player UI has
nothing to read for OCR. OCR needs the streamer script's clock in the stream.

## Earlier approach (replaced)

The first proof of concept (`poc/abema-sync-test.user.js`) estimated "behind
live" from the newest loaded segment, then counted real time passed minus video
time played. The estimate missed delay before segments reach the CDN (about
15.7 s estimated against about 22.8 s measured), and depends on each PC's server
and clock. Syncing on position replaced it.

## Not yet confirmed

- Positions match on two different PCs, VPNs or CDN servers.
- Positions stay matched across ad breaks (server-side ad insertion).
- Abema's player accepts setting `currentTime` directly (seeking).
- Other Abema channels use the same clock time positions.

## Planned

- OCR of the streamer clock from the Twitch picture. Ideas: compare digits to
  saved digit images (fixed font), and use the moment the seconds digit changes
  for sub-second timing instead of reading the tenths digit.
- Accounting for Twitch latency. Revisit picking the largest `video` element on
  the page (removed for now) at the same time.

## Player report script

To collect fresh data, paste `tools/player-report.js` into the Firefox console on
abema.tv, wait for "Report ready", then run `copy(playerReport)`. Remove session
codes from any URLs before sharing. Store reports in `reports/` (ignored by git).