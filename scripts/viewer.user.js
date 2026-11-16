// ==UserScript==
// @name         Sumo Sync - Viewer
// @version      0.1.0
// @description  Shows the broadcast time of the Abema video, with buttons to move the video
// @match        https://abema.tv/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  // Amounts (in seconds) for the move buttons, smallest first
  const stepSizes = [0.1, 0.5, 1, 5, 10];

  // Total amount moved with the buttons since the page loaded
  let totalMoved = 0;

  // ----- Build the box in the top left corner -----
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;top:10px;left:10px;z-index:999999;" +
    "background:#000;color:#fff;font:14px monospace;padding:8px;" +
    "border:1px solid #fff;";

  // Large clock showing the broadcast time, in the same format as the streamer script
  const clockText = document.createElement("div");
  clockText.style.cssText = "font-size:28px;margin-bottom:4px;";
  clockText.textContent = "--:--:--.-";

  // How far the player allows moving back or forward from the current position
  const rangeText = document.createElement("div");

  // Total amount moved so far and the result of the last button press
  const movedText = document.createElement("div");
  movedText.style.cssText = "margin-bottom:6px;";
  movedText.textContent = "Moved: 0.0 s";

  // Rows of buttons: one row to move back, one row to move forward
  const backRow = document.createElement("div");
  const forwardRow = document.createElement("div");
  forwardRow.style.cssText = "margin-top:4px;";

  box.append(clockText, rangeText, movedText, backRow, forwardRow);
  document.body.appendChild(box);

  // Simple border and spacing used for the buttons
  const buttonStyle = "background:#000;color:#fff;border:1px solid #fff;" +
    "margin-right:6px;padding:2px 8px;min-width:56px;";

  // Turn a video position in seconds into a UTC clock time such as 03:02:41.6
  function formatPosition(seconds) {
    return new Date(seconds * 1000).toISOString().substring(11, 21);
  }

  // Move the video by a number of seconds (negative moves back),
  // without going outside the part of the stream the player allows
  function moveVideo(amount) {
    const video = document.querySelector("video");
    if (!video || video.seekable.length === 0) return;

    const earliest = video.seekable.start(0) + 1;
    const latest = video.seekable.end(video.seekable.length - 1) - 1;
    let newPosition = video.currentTime + amount;

    if (newPosition < earliest) newPosition = earliest;
    if (newPosition > latest) newPosition = latest;

    const actualMove = newPosition - video.currentTime;
    video.currentTime = newPosition;
    totalMoved += actualMove;

    let text = "Moved: " + totalMoved.toFixed(1) + " s";
    if (Math.abs(actualMove - amount) > 0.05) {
      text += " (limit reached)";
    }
    movedText.textContent = text;
  }

  // Make one button for each step size in each row
  for (const step of stepSizes) {
    const backButton = document.createElement("button");
    backButton.textContent = "-" + step;
    backButton.style.cssText = buttonStyle;
    backButton.onclick = function () { moveVideo(-step); };
    backRow.appendChild(backButton);

    const forwardButton = document.createElement("button");
    forwardButton.textContent = "+" + step;
    forwardButton.style.cssText = buttonStyle;
    forwardButton.onclick = function () { moveVideo(step); };
    forwardRow.appendChild(forwardButton);
  }

  // Every tenth of a second: update the clock and the allowed range
  setInterval(function () {
    const video = document.querySelector("video");
    if (!video || video.readyState < 2) {
      clockText.textContent = "--:--:--.-";
      rangeText.textContent = "Waiting for video";
      return;
    }

    // A position below one billion seconds is not a real clock time (before 2001),
    // which means the stream does not use clock time positions
    if (video.currentTime < 1000000000) {
      clockText.textContent = "NO CLOCK";
      return;
    }

    clockText.textContent = formatPosition(video.currentTime);

    if (video.seekable.length > 0) {
      const backAvailable = video.currentTime - video.seekable.start(0);
      const forwardAvailable = video.seekable.end(video.seekable.length - 1) - video.currentTime;
      rangeText.textContent = "Can move back " + backAvailable.toFixed(1) +
        " s / forward " + forwardAvailable.toFixed(1) + " s";
    }
  }, 100);
})();
