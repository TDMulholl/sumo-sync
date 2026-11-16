# Sumo Sync

Userscripts for syncing a local AbemaTV player with a streamer's Abema stream.

Abema's live player sets the video position to a real clock time (seconds since
1 Jan 1970, UTC). The same frame has the same position for every viewer, so two
players are in sync when their positions match.

## Scripts

| File | Who runs it | What it does |
|---|---|---|
| `scripts/streamer.user.js` | Streamer | Shows the broadcast time (UTC) of the frame on screen |
| `scripts/viewer.user.js` | Viewer | Shows the same time, plus buttons to move the video back or forward |
| `poc/` | - | Earlier proof of concept scripts, kept for reference |

## Install

1. Install [Violentmonkey](https://violentmonkey.github.io/) or Tampermonkey in Firefox.
2. Open the script file on GitHub, click **Raw**, and install it.
3. Open a live channel on abema.tv.

## Manual sync

1. Watch the streamer's Twitch stream and the Abema channel side by side.
2. Compare the clock in the streamer's stream with the clock in the viewer box.
3. Use the buttons to move the video until both clocks show the same time.

## Known limits

- Only about 60 seconds can be rewound (`timeShiftBufferDepth` in the stream manifest).
- Not yet checked across two PCs or across ad breaks.
