"use babel";

var _ = require("lodash");
var floop = require("./floop");
var getUserMedia = require("./extern/webrtc/get_user_media");

const THUMB_WIDTH = 228;
const THUMB_HEIGHT = 228;

function MugShot (node) {
  this.snapshotInterval = null;
  this.drawTimeout = null;
  this.users = null;
  /**
   * @type {Element}
   */
  this.videoEl = document.createElement("video");
  this.videoEl.id = "snapshot-video";
  this.videoEl.setAttribute("width", THUMB_WIDTH);
  this.videoEl.setAttribute("height", THUMB_HEIGHT);

  /**
   * @type {Element}
   */
  this.canvasEl = document.createElement("canvas");
  this.canvasEl.id = "snapshot-canvas";
  this.canvasEl.setAttribute("width", THUMB_WIDTH);
  this.canvasEl.setAttribute("height", THUMB_HEIGHT);

  /**
   * @type {Object}
   */
  this.canvasContext = this.canvasEl.getContext("2d");
  /**
   * @type {Object?}
   */
  this.stream = null;
}

MugShot.prototype.start = function (users, myConn) {
  this.stop();
  this.users = users;
  this.myConn = myConn;
  this.snapshotInterval = setInterval(_.bind(this.snapshot, this), 60000);
  this.snapshot();
};

MugShot.prototype.stop = function () {
  clearInterval(this.snapshotInterval);
  this.snapshotInterval = null;
  clearTimeout(this.drawTimeout);
  this.drawTimeout = null;
  this.stopStream();
  if (this.myConn) {
    this.myConn.image = null;
  }
};

MugShot.prototype.snapshot = function () {
  console.log("Creating snapshot.");
  getUserMedia({
    audio: false,
    video: { optional: [
      { maxWidth: THUMB_WIDTH },
      { maxHeight: THUMB_HEIGHT }
    ]}
  }, _.bind(this.gotUserMedia, this));
};

MugShot.prototype.stopStream = function () {
  if (this.stream) {
    try {
      this.stream.stop();
    } catch (e) {
      console.error("Error stopping stream in stopStream:", e);
    }
    this.stream = null;  
  }
  
  if (this.videoEl.src) {
    try {
      this.videoEl.pause();
    } catch (e) {
      console.error("Error pausing video in stopStream:", e);
    }
    this.videoEl.src = "";
  }

  clearTimeout(this.drawTimeout);
  this.drawTimeout = null;
};

/**
 * @param {Object} media
 */
MugShot.prototype.gotUserMedia = function (err, stream) {
  var i = 100, draw,
    canvas = this.canvasEl,
    video = this.videoEl;

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

  video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
  video.play();
  // some cameras take time to "warm up." Check image data for values besides 0 and display.
  draw = function () {
    i--;
    try {
      this.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
      this.canvasContext.drawImage(video, 0, 0, video.width, video.height);
      // this.canvasContext.fillText("send time:" + Date(), 0, 10);
    } catch (e) {
      console.log("Capture self shot failed.", e);
    }
    if (this.handleFrame_()) {
      console.log("handled snapshot");
      this.stopStream();
      return;
    }
    if (i <= 0) {
      console.log("snapshot still not ready. forcing");
      this.handleFrame_(true);
      this.stopStream();
      return;
    }
    this.drawTimeout = setTimeout(draw, 50);
  }.bind(this);
  _.defer(draw);
};

/**
 * @param {Object} event
 * @private
 */
MugShot.prototype.handleFrame_ = function (force) {
  var self = this,
    canvas = self.canvasEl,
    data,
    i, r, g, b,
    imageData = self.canvasContext.getImageData(0, 0, canvas.width, canvas.height),
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
  if (goodPixels < imageData.data.length * 0.10 && !force) {
    return false;
  }
  if (force) {
    return true;
  }

  this.myConn.image = imageData;

  const conns = this.users.connsForPerm("datamsg", "patch");
  if (!conns.length) {
    return true;
  }

  floop.emitDataMessage({
    name: "user_image",
    image: {
      width: canvas.width,
      height: canvas.height,
      data: data
    }
  }, "patch");

  return true;
};

module.exports = new MugShot();
