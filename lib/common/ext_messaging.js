/*global fl */
"use strict";

const _ = require("lodash");
const $ = require("atom-space-pen-views").$;

const floop = require("./floop");
const webrtcAction = require("./webrtc_action");

var callback;

/*
 * @param {Object} event
 */
function handleMessage(event) {
  event = event.originalEvent;
  if (!event.data) {
    return;
  }
  switch(event.data.name) {
    case "flooScreenShareResponse":
      console.log("Got content script stuff", event);
      callback(event.data.id);
      break;
    case "flooScreenHasExtension":
      console.log("Website: user has extension");
      webrtcAction.can_share_screen(true);
      break;
    default:
      // no-op
  }
}

/**
 * @param {Function} cb
 */
function getSharedScreenId(cb) {
  callback = cb;
  setTimeout(function () {
    console.log("Getting screen share id");
    window.postMessage({text: "flooScreenShare"}, "*");
  }, 1);
}

/**
 * Let's ask to see if we can share the screen.
 */
function getCanShare() {
  setTimeout(function () {
    console.log("Checking to see if we have a chrome extension.");
    window.postMessage({text: "flooScreenDoWeHaveAnExtension"}, "*");
  }, 0);
}

function init() {
  console.log("Initing ext msg.");
  $(window).on("message", handleMessage);

  function changeListener (evt) {
    var evt_data,
      origin,
      parse_url;

    parse_url = function (url) {
      var a = document.createElement("a");
      a.href = url;
      return {
        hostname: a.hostname,
        port: a.port,
        protocol: a.protocol
      };
    };
    origin = parse_url(evt.origin);
    if (origin.protocol !== "https:" || !origin.hostname.match(/\.googleusercontent\.com$/)) {
      console.log("discarding because event origin is", origin);
      return;
    }
    console.log("got event", evt.data);
    try {
      evt_data = JSON.parse(evt.data);
    } catch (e) {
      console.log("Couldn't parse event json:", e);
      return;
    }
    if (evt_data.temp_data) {
      fl.editor_settings.temp_data = _.extend(fl.editor_settings.temp_data,
          evt_data.temp_data);
      try {
        floop.set_temp_data(evt_data.temp_data);
      } catch (e) {
        console.log(e);
      }
    }
  }

  if (window.parent) {
    if (window.addEventListener) {
      window.addEventListener("message", changeListener, false);
    } else if (window.attachEvent) {
      window.attachEvent("onmessage", changeListener);
    }
    window.parent.postMessage(JSON.stringify({
      owner: fl.editor_settings.room_owner,
      room: fl.editor_settings.room
    }),
    "*");
  }
}

module.exports = {
  getSharedScreenId: getSharedScreenId,
  getCanShare: getCanShare,
  init: init
};
