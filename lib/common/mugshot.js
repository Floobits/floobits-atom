"use strict";

const _ = require("lodash");
const getUserMedia = require("./extern/webrtc/get_user_media");

// const handlerActions = require("./handler_action");
const messageAction = require("./message_action");
const perms = require("./permission_model");
const prefs = require("./userPref_model");
const WebRTC = require("./webrtc");

const THUMB_WIDTH = 228;
const THUMB_HEIGHT = 228;

function MugShot() {
  this.snapshotInterval = null;
  this.drawTimeouts = {};
  this.stream = null;
}

MugShot.prototype.start = function (users, myConn) {
  if (perms.indexOf("patch") === -1) {
    messageAction.info("Mugshots require edit permission.");
    return;
  }
  this.stop();
  this.users = users;
  this.myConn = myConn;
  this.snapshotInterval = setInterval(_.bind(this.snapshot, this), 60000);
  this.snapshot();
};

MugShot.prototype.stop = function () {
  clearInterval(this.snapshotInterval);
  this.snapshotInterval = null;
  this.clearDrawTimeouts();
  this.stopStream();
  if (this.myConn) {
    this.myConn.image = null;
  }
};

MugShot.prototype.snapshot = function () {
  console.log("Creating snapshot.");

  const options = {
    audio: false,
    video: { optional: [
      { maxWidth: THUMB_WIDTH },
      { maxHeight: THUMB_HEIGHT },
    ]}
  };

  if (prefs.source_video_id) {
    options.video.optional.push({ sourceId: prefs.source_video_id });
  } else {
    options.video.optional.push({ facingMode: "user" });
  }

  getUserMedia(options, _.bind(this.gotUserMedia, this));
};

MugShot.prototype.clearDrawTimeouts = function () {
  _.each(this.drawTimeouts, function (timeout) {
    clearTimeout(timeout);
  });
  this.drawTimeouts = {};
};

MugShot.prototype.stopStream = function () {
  if (this.stream) {
    try {
      WebRTC.stopStream(this.stream);
    } catch (e) {
      console.error("Error stopping stream in stopStream:", e);
    }
    this.stream = null;
  }

  this.clearDrawTimeouts();
};

/**
 * @param {Object} media
 */
MugShot.prototype.gotUserMedia = function (err, stream) {
  if (err) {
    console.error("Error getting snapshot!", err);
    return;
  }

  if (this.stream) {
    console.error("Mug shot stream already exists! Killing old stream");
    try {
      this.stream.stop();
    } catch (e) {
      console.error("Error stopping stream in gotUserMedia:", e);
    }
  }

  this.stream = stream;

  this.getSnapshotFromStream(stream, function (snapErr, data) {
    if (snapErr) {
      console.error("Error getting snapshot from stream:", snapErr);
    }
    this.users.broadcast_data_message_for_perm({
      name: "user_image",
      image: data,
    }, "get_buf");
    this.myConn.image = data;
    this.stopStream();
  }.bind(this));
};

// TODO: remove this.drawTimeout. right now capturing two mugshots from different streams will break
MugShot.prototype.getSnapshotFromStream = function (stream, cb) {
  const self = this;

  let video = document.createElement("video");
  video.setAttribute("width", THUMB_WIDTH);
  video.setAttribute("height", THUMB_HEIGHT);

  const canvas = document.createElement("canvas");
  canvas.setAttribute("width", THUMB_WIDTH);
  canvas.setAttribute("height", THUMB_HEIGHT);

  let canvasContext = canvas.getContext("2d");

  // I think the window stuff is to grab fullscreen video?
  video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
  video.play();

  function done(err, result) {
    try {
      // Please oh please oh please get GC'd!
      video.pause();
      video.src = "";
      video = null;
    } catch (e) {
      console.error("Mugshot draw: Error pausing video:", e);
    }
    try {
      delete self.drawTimeouts[stream];
    } catch (unused) {
      // Ignore
    }
    return cb(err, result);
  }

  // Some cameras take time to warm up. Check image data for values besides 0 before displaying.
  // Typical framerate is 30fps, so give up after 1.5 seconds
  let i = 45;
  function draw() {
    var data;
    i--;
    try {
      canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      canvasContext.drawImage(video, 0, 0, video.width, video.height);
    } catch (e) {
      console.log("Capture self shot failed.", e);
    }
    data = self.handleFrame_(canvas, canvasContext, false);
    if (data) {
      console.log("handled snapshot");
      return done(null, data);
    }
    if (i <= 0) {
      console.log("snapshot still not ready. forcing");
      data = self.handleFrame_(canvas, canvasContext, true);
      return done(null, data);
    }
    // 30fps === 33.3...ms per frame
    self.drawTimeouts[stream] = setTimeout(draw, 34);
  }
  _.defer(draw.bind(this));
};

MugShot.prototype.handleFrame_ = function (canvas, canvasContext, force) {
  var data,
    i, r, g, b,
    imageData = canvasContext.getImageData(0, 0, canvas.width, canvas.height),
    goodPixels = 0;

  data = new Array(imageData.data.length / 4);
  for (i = 0; i < data.length; i++) {
    r = imageData.data[i * 4];
    g = imageData.data[i * 4 + 1];
    b = imageData.data[i * 4 + 2];
    data[i] = Math.round(0.21 * r + 0.72 * g + 0.07 * b);
    imageData.data[i * 4] = data[i];
    imageData.data[i * 4 + 1] = data[i];
    imageData.data[i * 4 + 2] = data[i];
    if (data[i] > 20 && data[i] < 240) {
      goodPixels++;
    }
  }
  if (goodPixels < (imageData.data.length * 0.10) && !force) {
    return null;
  }
  canvasContext.putImageData(imageData, 0, 0);
  data = {
    width: canvas.width,
    height: canvas.height,
    data: canvas.toDataURL(),
  };

  return data;
};

module.exports = new MugShot();
