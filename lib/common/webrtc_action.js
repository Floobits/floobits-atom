/* @flow weak */
/*global chrome, self */
"use strict";

var flux = require('flukes'),
  Actions,
  can_share_screen = false,
  modal = require("../modal"),
  editorAction = require("./editor_action"),
  messageAction = require("./message_action"),
  perms = require("./permission_model"),
  prefs = require("./userPref_model");


Actions = flux.createActions({
  /**
   * {number} connId
   * @return {number|Error}
   */
  start_video_chat: function (connId) {
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
  /**
   * {number} connId
   * @return {number}
   */
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
    if (can_share_screen) {
      if (prefs.dnd) {
        editorAction.pref("dnd", false);
        messageAction.info("Do not disturb disabled.");
      }
      return connId;
    }

    if (!self.chrome || !chrome.app) {
      errMsg = "Screen sharing requires Google Chrome and the Floobits screen sharing extension.";
      modal.showWithText(errMsg, "Can't Share Screen");
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
  /**
   * @param {boolean} can
   * return {boolean}
   */
  can_share_screen: function (can) {
    can_share_screen = can;
    return can;
  },
});

module.exports = new Actions();
