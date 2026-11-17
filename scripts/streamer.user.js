// ==UserScript==
// @name         Sumo Sync - Streamer
// @version      0.1.0
// @description  Shows the broadcast time of the Abema video on screen
// @match        https://abema.tv/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/TDMulholl/sumo-sync/main/scripts/streamer.user.js
// @downloadURL  https://raw.githubusercontent.com/TDMulholl/sumo-sync/main/scripts/streamer.user.js
// ==/UserScript==

(function () {
  // Box in the top left corner holding the clock
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;top:10px;left:10px;z-index:999999;" +
    "background:#000;color:#fff;font:28px monospace;padding:6px 10px;" +
    "border:1px solid #fff;";
  box.textContent = "--:--:--.-";
  document.body.appendChild(box);

  // Turn a video position in seconds into a UTC clock time such as 03:02:41.6
  function formatPosition(seconds) {
    return new Date(seconds * 1000).toISOString().substring(11, 21);
  }

  // Every tenth of a second: show the broadcast time of the frame on screen
  setInterval(function () {
    const video = document.querySelector("video");
    if (!video || video.readyState < 2) {
      box.textContent = "--:--:--.-";
      return;
    }

    // A position below one billion seconds is not a real clock time (before 2001),
    // which means the stream does not use clock time positions
    if (video.currentTime < 1000000000) {
      box.textContent = "NO CLOCK";
      return;
    }

    box.textContent = formatPosition(video.currentTime);
  }, 100);
})();
