/* @flow weak */
/*global self, fl, Notification */
"use strict";

const _ = require("lodash");
const flux = require("flukes");

const buttonModel = require("./button_model");
const messagesModel = require("./message_model");
const prefs = require("./userPref_model");

const NOTIFICATION_DURATION = 5 * 1000;
const notifications = [];


// Clear notifications on window close
self.addEventListener("beforeunload", function () {
  _.each(notifications, function (n) {
    n.close();
  });
});

const Actions = flux.createActions({
  notify: function (msg, force) {
    var n;
    if (force !== true) {
      if (!prefs.showNotifications || !prefs.canNotify) {
        return;
      }
      // if (window.document.hasFocus && window.document.hasFocus()) {
      //   return;
      // }
    }
    if (fl.editor_settings) {
      msg = fl.editor_settings.room + ": " + msg;
    }
    n = new Notification("floobits", {
      body: msg,
      icon: "atom://floobits/resources/icon_64x64.png",
    });

    notifications.push(n);

    n.onshow = function () {
      _.delay(function () {
        n.close();
        notifications.splice(notifications.indexOf(n), 1);
      }, NOTIFICATION_DURATION);
    };
  },
  log: function (msg, opt_alertLvl, notify) {
    var msgObject;
    opt_alertLvl = opt_alertLvl || messagesModel.LEVEL.INFO;
    msgObject = new messagesModel.Message({
      msg: msg,
      type: "log",
      level: opt_alertLvl,
    });
    this.messages.insert(msgObject, 0);
    if (notify === false) {
      return msgObject;
    }
    if (notify === true || opt_alertLvl >= messagesModel.LEVEL.WARNING) {
      this.notify(msg);
    }
    return msgObject;
  },
  info: function (msg, notify) {
    return this.log(msg, messagesModel.LEVEL.INFO, notify);
  },
  success: function (msg, notify) {
    return this.log(msg, messagesModel.LEVEL.SUCCESS, notify);
  },
  warn: function (msg, notify) {
    return this.log(msg, messagesModel.LEVEL.WARNING, notify);
  },
  error: function (msg, notify) {
    return this.log(msg, messagesModel.LEVEL.DANGER, notify);
  },
  modal: function (msg) {
    return msg;
  },
  interactive: function (msg, buttons) {
    var msgObject = new messagesModel.Message({
      msg: msg,
      type: "interactive",
      buttons: buttons.map(function (b) {
        return new buttonModel.Button(b);
      }),
    });
    this.messages.insert(msgObject, 0);
    return msgObject;
  },
  user: function (username, msg, time) {
    var msgObject = new messagesModel.Message({
      type: "user",
      username: username,
      msg: msg,
      time: time * 1000 || Date.now(),
    });
    this.messages.insert(msgObject, 0);
    if (username !== fl.username) {
      this.notify("<" + username + "> " + msg);
    }
    return msgObject;
  },
  messages: messagesModel.Messages,
});

module.exports = new Actions();
