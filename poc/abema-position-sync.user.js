// ==UserScript==
// @name         Abema Position Sync Test
// @match        https://abema.tv/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  // Gap (in seconds) small enough to count as synced
  const closeEnough = 0.1;

  // Playback speeds used by the "Drift" button to slowly catch up or fall back
  const speedUp = 1.1;
  const slowDown = 0.9;

  // Seconds in one day, used when the typed time is on the other side of midnight
  const secondsInDay = 86400;

  // TESTING ONLY: link between the two Firefox windows on the same PC, used to
  // share each window's video position. The real version reads the streamer's
  // position from the streamer's Twitch picture (OCR), so the link can be removed.
  const channel = new BroadcastChannel("abema-position-sync-test");

  // Saved details used by the Drift button
  let drifting = false;       // true while the Drift button is adjusting speed
  let targetPosition = 0;     // streamer position typed in the box (seconds)
  let targetClickTime = 0;    // clock time (seconds) when Jump or Drift was clicked
  let lastPosition = null;    // most recent video position for this window

  // ----- Build the small box in the top left corner -----
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;top:10px;left:10px;z-index:999999;" +
    "background:#000;color:#fff;font:14px monospace;padding:8px;" +
    "border:1px solid #fff;";

  // Text box at the top for typing a label such as "Streamer" or "Viewer".
  // The label is only for telling the windows apart and is not used anywhere else.
  const labelInput = document.createElement("input");
  labelInput.placeholder = "Streamer / Viewer";
  labelInput.size = 18;
  labelInput.style.cssText = "display:block;margin-bottom:6px;";

  // Large clock showing the broadcast moment on screen (UTC). Kept large so
  // OCR can read the clock from the streamer's Twitch picture later.
  const positionText = document.createElement("div");
  positionText.style.cssText = "font-size:28px;margin-bottom:4px;";

  // Seconds behind real time, and how far the player allows moving back or forward
  const behindText = document.createElement("div");
  const rangeText = document.createElement("div");

  // TESTING ONLY: line showing the other window's position and the difference.
  // Not needed once the streamer's position comes from OCR.
  const otherText = document.createElement("div");
  otherText.style.cssText = "margin-bottom:6px;";

  // Manual entry box for the streamer's position, for example 03:02:41.6
  // In the real version OCR fills in the position automatically.
  const targetInput = document.createElement("input");
  targetInput.placeholder = "streamer HH:MM:SS.s";
  targetInput.size = 18;

  // Simple border and spacing used for the buttons
  const buttonStyle = "background:#000;color:#fff;border:1px solid #fff;" +
    "margin-left:8px;padding:2px 8px;";

  const jumpButton = document.createElement("button");
  jumpButton.textContent = "Jump";
  jumpButton.style.cssText = buttonStyle;

  const driftButton = document.createElement("button");
  driftButton.textContent = "Drift";
  driftButton.style.cssText = buttonStyle;

  const statusText = document.createElement("div");
  statusText.style.cssText = "margin-top:6px;";

  positionText.textContent = "--:--:--.-";
  otherText.textContent = "Other window: no data";

  box.append(labelInput, positionText, behindText, rangeText, otherText,
    targetInput, jumpButton, driftButton, statusText);
  document.body.appendChild(box);

  // Current clock time in seconds
  function now() {
    return Date.now() / 1000;
  }

  // Find the video on the page (the first video element found)
  function findVideo() {
    return document.querySelector("video");
  }

  // Turn a position in seconds into a UTC clock time such as 03:02:41.6
  function formatPosition(seconds) {
    return new Date(seconds * 1000).toISOString().substring(11, 21);
  }

  // Turn a typed time such as 03:02:41.6 into a full position in seconds.
  // The date is taken from the current video position, with a fix for
  // times on the other side of midnight.
  function parsePosition(typedText, currentPosition) {
    const parts = typedText.trim().split(":");
    if (parts.length !== 3) return null;

    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;

    const startOfDay = Math.floor(currentPosition / secondsInDay) * secondsInDay;
    let position = startOfDay + hours * 3600 + minutes * 60 + seconds;

    // More than half a day away means the typed time belongs to the day before or after
    if (position - currentPosition > secondsInDay / 2) position -= secondsInDay;
    if (currentPosition - position > secondsInDay / 2) position += secondsInDay;

    return position;
  }

  // Streamer position right now: the typed position plus the time passed since
  // the button was clicked (the streamer's video keeps playing)
  function getTargetNow() {
    return targetPosition + (now() - targetClickTime);
  }

  // Read the typed position and save the click time, or show a message when
  // the entry is not a valid time. Returns true when the entry is valid.
  function readTarget(video) {
    const position = parsePosition(targetInput.value, video.currentTime);
    if (position === null) {
      statusText.textContent = "Enter a time like 03:02:41.6";
      return false;
    }
    targetPosition = position;
    targetClickTime = now();
    return true;
  }

  // ----- Jump: move straight to the streamer's position -----
  jumpButton.onclick = function () {
    const video = findVideo();
    if (!video || !readTarget(video)) return;

    drifting = false;
    video.playbackRate = 1;

    const target = getTargetNow();
    const earliest = video.seekable.start(0) + 1;
    const latest = video.seekable.end(video.seekable.length - 1) - 1;

    if (target < earliest) {
      video.currentTime = earliest;
      statusText.textContent = "Too far back, moved as far back as possible";
    } else if (target > latest) {
      video.currentTime = latest;
      statusText.textContent = "Too far ahead, moved as far forward as possible";
    } else {
      const difference = target - video.currentTime;
      video.currentTime = target;
      statusText.textContent = "Jumped " + difference.toFixed(2) + " s";
    }
  };

  // ----- Drift: slowly speed up or slow down until the position matches -----
  driftButton.onclick = function () {
    const video = findVideo();
    if (!video || !readTarget(video)) return;
    drifting = true;
  };

  // ----- Every tenth of a second: update the display and handle drifting -----
  setInterval(function () {
    const video = findVideo();
    if (!video || video.readyState < 2) {
      positionText.textContent = "--:--:--.-";
      behindText.textContent = "Waiting for video";
      return;
    }

    lastPosition = video.currentTime;

    // A position below one billion seconds is not a real clock time (before 2001),
    // which means the method used here does not work on this stream
    if (lastPosition < 1000000000) {
      positionText.textContent = "--:--:--.-";
      behindText.textContent = "Position is not a clock time: " + lastPosition.toFixed(1);
      return;
    }

    positionText.textContent = formatPosition(lastPosition) + " UTC";
    behindText.textContent = "Behind real time: " + (now() - lastPosition).toFixed(2) + " s";

    if (video.seekable.length > 0) {
      const backAvailable = lastPosition - video.seekable.start(0);
      const forwardAvailable = video.seekable.end(video.seekable.length - 1) - lastPosition;
      rangeText.textContent = "Can move back " + backAvailable.toFixed(1) +
        " s / forward " + forwardAvailable.toFixed(1) + " s";
    }

    // TESTING ONLY: send this window's position to the other window
    channel.postMessage(lastPosition);

    if (drifting) {
      // Positive gap means this window needs to move forward to match
      const gap = getTargetNow() - lastPosition;
      if (Math.abs(gap) < closeEnough) {
        video.playbackRate = 1;
        drifting = false;
        statusText.textContent = "Drift done";
      } else if (gap > 0) {
        video.playbackRate = speedUp;
        statusText.textContent = "Speeding up, " + gap.toFixed(2) + " s to go";
      } else {
        video.playbackRate = slowDown;
        statusText.textContent = "Slowing down, " + (-gap).toFixed(2) + " s to go";
      }
    }
  }, 100);

  // TESTING ONLY: when the other window sends a position, show the position and
  // the difference between the two windows. Used to check the sync worked.
  // Positive difference means this window is ahead of the other window.
  channel.onmessage = function (event) {
    const otherPosition = event.data;
    let text = "Other window: " + formatPosition(otherPosition);
    if (lastPosition !== null) {
      text += " (difference " + (lastPosition - otherPosition).toFixed(2) + " s)";
    }
    otherText.textContent = text;
  };
})();
