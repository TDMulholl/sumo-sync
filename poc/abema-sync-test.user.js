// ==UserScript==
// @name         Abema Sync Test
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

  // TESTING ONLY: link between the two Firefox windows on the same PC, used to
  // share each window's "behind live" number. The real version gets the
  // streamer's number from the streamer's stream (OCR), so the link can be removed.
  const channel = new BroadcastChannel("abema-sync-test");

  // Saved details about the video, used to keep track of time
  let video = null;
  let startRealTime = 0;   // clock time (seconds) when tracking started
  let startVideoTime = 0;  // video position (seconds) when tracking started
  let startBehind = 0;     // seconds behind live when tracking started
  let lastBehind = null;   // most recent "behind live" number for this window
  let drifting = false;    // true while the Drift button is adjusting speed
  let driftTarget = 0;     // "behind live" number the Drift button is aiming for

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

  const myText = document.createElement("div");
  const statusText = document.createElement("div");

  // TESTING ONLY: line showing the other window's number. Not needed once the
  // streamer's number comes from OCR instead of a second window.
  const otherText = document.createElement("div");

  // TESTING ONLY: manual entry box for the streamer's "behind live" number.
  // In the real version OCR fills in the number automatically.
  const targetInput = document.createElement("input");
  targetInput.placeholder = "streamer behind (s)";
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

  myText.textContent = "This window: waiting for video";
  otherText.textContent = "Other window: no data";

  box.append(labelInput, myText, otherText, targetInput, jumpButton, driftButton, statusText);
  document.body.appendChild(box);

  // Current clock time in seconds
  function now() {
    return Date.now() / 1000;
  }

  // Find the video on the page (the first video element found)
  function findVideo() {
    return document.querySelector("video");
  }

  // Newest point of the stream known to the player (best guess at "live")
  function getLiveEdge(someVideo) {
    if (someVideo.seekable.length > 0) {
      const end = someVideo.seekable.end(someVideo.seekable.length - 1);
      if (isFinite(end)) return end;
    }
    if (someVideo.buffered.length > 0) {
      return someVideo.buffered.end(someVideo.buffered.length - 1);
    }
    return someVideo.currentTime;
  }

  // Start tracking a video: save the current clock time, video position
  // and distance from live
  function startTracking(newVideo) {
    video = newVideo;
    startRealTime = now();
    startVideoTime = newVideo.currentTime;
    startBehind = getLiveEdge(newVideo) - newVideo.currentTime;
    drifting = false;
  }

  // Seconds behind live right now:
  // starting distance + real time passed - video time played.
  // Keeps counting up correctly while the video is paused or buffering.
  function getBehind() {
    const realTimePassed = now() - startRealTime;
    const videoTimePassed = video.currentTime - startVideoTime;
    return startBehind + realTimePassed - videoTimePassed;
  }

  // TESTING ONLY: read the number typed in the manual entry box, or show a
  // message when the entry is not a number. In the real version the number
  // comes from the streamer's stream by OCR.
  function readTarget() {
    const target = parseFloat(targetInput.value);
    if (isNaN(target) || !video) {
      statusText.textContent = "Enter a number first";
      return null;
    }
    return target;
  }

  // ----- Jump: reach the target in one go -----
  jumpButton.onclick = function () {
    const target = readTarget();
    if (target === null) return;

    drifting = false;
    video.playbackRate = 1;

    // Positive means falling further behind is needed, negative means catching up is needed
    const difference = target - getBehind();

    if (difference > 0) {
      // Fall behind by pausing for the difference in seconds, then play again
      statusText.textContent = "Pausing for " + difference.toFixed(2) + " s";
      video.pause();
      setTimeout(function () {
        video.play();
        statusText.textContent = "Jump done";
      }, difference * 1000);
    } else {
      // Catch up by skipping forward, but not past the loaded part of the stream
      const newTime = video.currentTime - difference;
      const furthest = getLiveEdge(video) - 0.5;
      if (newTime > furthest) {
        video.currentTime = furthest;
        statusText.textContent = "Can't get that close to live, skipped as far as possible";
      } else {
        video.currentTime = newTime;
        statusText.textContent = "Skipped forward " + (-difference).toFixed(2) + " s";
      }
    }
  };

  // ----- Drift: slowly speed up or slow down until the target is reached -----
  driftButton.onclick = function () {
    const target = readTarget();
    if (target === null) return;
    driftTarget = target;
    drifting = true;
  };

  // ----- Every quarter second: update the numbers and handle drifting -----
  setInterval(function () {
    const pageVideo = findVideo();
    if (!pageVideo || pageVideo.readyState < 2) {
      myText.textContent = "This window: waiting for video";
      return;
    }

    // New video (first load or channel change), start tracking from scratch
    if (pageVideo !== video) {
      startTracking(pageVideo);
    }

    lastBehind = getBehind();
    myText.textContent = "This window behind live: " + lastBehind.toFixed(2) + " s";

    // TESTING ONLY: send this window's number to the other window
    channel.postMessage(lastBehind);

    if (drifting) {
      const gap = lastBehind - driftTarget;
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
  }, 250);

  // TESTING ONLY: when the other window sends a number, show the number and the
  // difference between the two windows. Used to check the sync worked.
  channel.onmessage = function (event) {
    const otherBehind = event.data;
    let text = "Other window behind live: " + otherBehind.toFixed(2) + " s";
    if (lastBehind !== null) {
      text += " (difference " + (lastBehind - otherBehind).toFixed(2) + " s)";
    }
    otherText.textContent = text;
  };
})();
