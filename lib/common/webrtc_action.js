/* @flow weak */
/*global chrome, self */
"use strict";

var canShareScreen = false,
  cantStartVideoChat = false;

const _ = require("lodash");
const flux = require("flukes");

const Modal = require("../modal");
const editorAction = require("./editor_action");
const messageAction = require("./message_action");
const perms = require("./permission_model");
const prefs = require("./userPref_model");


const Actions = flux.createActions({
  start_video_chat: function (connId) {
    if (cantStartVideoChat) {
      return new Error("Can't start video yet.");
    }
    if (prefs.dnd) {
      editorAction.pref("dnd", false);
      messageAction.info("Do not disturb disabled.");
    }
    if (perms.indexOf("patch") === -1) {
      messageAction.info("You need edit permissions to video chat.");
      return new Error("No permission to video chat.");
    }
    // Kinda hacky but whatever.
    if (prefs.audioOnly) {
      this.start_audio_chat(connId);
      return new Error("Starting audio chat.");
    }
    return connId;
  },
  stop_video_chat: function (connId) {
    // Kinda hacky but whatever.
    if (prefs.audioOnly) {
      this.stop_audio_chat(connId);
      return new Error("Stopping audio chat.");
    }
    return connId;
  },
  start_audio_chat: function (connId) {
    return connId;
  },
  stop_audio_chat: function (connId) {
    return connId;
  },
  start_screen: function (connId) {
    var errMsg;
    if (canShareScreen) {
      if (prefs.dnd) {
        editorAction.pref("dnd", false);
        messageAction.info("Do not disturb disabled.");
      }
      return connId;
    }

    if (!self.chrome || !chrome.app) {
      errMsg = "Screen sharing requires Google Chrome and the Floobits screen sharing extension.";
      Modal.showWithText(errMsg, "Can't Share Screen");
      messageAction.warn(errMsg);
      return new Error(errMsg);
    }

    try {
      chrome.webstore.install("https://chrome.google.com/webstore/detail/lmojaknpofhmdnbpanagbbeinbjmbodo", function () {
        self.location.reload();
      });
    } catch (e) {
      self.open("https://chrome.google.com/webstore/detail/lmojaknpofhmdnbpanagbbeinbjmbodo");
    }
    return new Error("User may install extension");
  },
  stop_screen: function (connId) {
    return connId;
  },
  can_share_screen: function (can) {
    canShareScreen = can;
    return can;
  },
  get_constraints: function (type, baseContraints, cb) {
    const constraints = _.extend({}, baseContraints);

    const getSource = function (sources, _type) {
      const id = prefs["source_" + _type + "_id"];

      let source = _.find(sources, function (s) {
        return s.id === id && s.kind === _type;
      });

      if (source) {
        return source.id;
      }

      const name = prefs["source_" + _type + "_name"];

      console.warn("Could not find video source", id);
      source = _.find(sources, function (s) {
        return s.label === name && s.kind === _type;
      });

      if (source) {
        console.warn("Found source with the same name", name);
        return source.id;
      }
      return null;
    };

    if (!MediaStreamTrack || !MediaStreamTrack.getSources || type === "screen") {
      return cb(null, constraints);
    }

    MediaStreamTrack.getSources(function (sources) {
      let getAudioDevice = type === "audio";
      if (type === "video") {
        if (_.isBoolean(baseContraints.audio)) {
          getAudioDevice = baseContraints.audio;
        } else {
          getAudioDevice = _.isObject(baseContraints.audio);
        }
      }
      if (getAudioDevice) {
        const id = getSource(sources, "audio");
        if (id) {
          let c = constraints.audio;
          if (_.isBoolean(c)) {
            c = constraints.audio = {};
          }
          if (!c.optional) {
            c.optional = [];
          }
          c.optional.push({sourceId: id});
        }
      }
      if (type === "video") {
        const id = getSource(sources, type);
        if (id) {
          constraints[type].optional.push({sourceId: id});
        }
      }
      console.log("constraints for", type, constraints);
      return cb(null, constraints);
    });
  },
  closedStreams: function () {
    if (cantStartVideoChat) {
      return;
    }
    cantStartVideoChat = true;
    _.delay(function () {
      cantStartVideoChat = false;
    }, 2000);
  },
});

module.exports = new Actions();
