/*global HTMLElement: true */

"use strict";

const _ = require("lodash");
const floorc = require("../common/floorc");
const message_action = require("../common/message_action");

const Proto = Object.create(HTMLElement.prototype);

Proto.createdCallback = function () {
  const frame = document.createElement("iframe");
  frame.allowtransparency = "on";
  frame.id = "asdfifiafjfj";
  frame.style.border = "0 none";
  frame.style.width = "100%";
  frame.style.height = "100%";
  this.frame = frame;
};

Proto.load = function (host) {
  this.host = host;
  this.frame.src = host + "/signup/atom";
};

Proto.handle_login = function (auth) {
  const host = _.keys(auth)[0];
  auth = auth[host];

  if (!_.has(floorc, "auth")) {
    floorc.auth = {};
  }

  if (!_.has(floorc.auth, host)) {
    floorc.auth[host] = {};
  }
  const floorc_auth = floorc.auth[host];
  const username = auth.username;
  if (floorc_auth.username && floorc_auth.username !== username) {
    console.error("username changed?", auth.username, username);
  }
  floorc_auth.username = username;
  floorc_auth.api_key = auth.api_key;
  floorc_auth.secret = auth.secret;
  try {
    floorc.__write();
  } catch (e) {
    return message_action.error(e);
  }
};

Proto.attachedCallback = function () {
  this.appendChild(this.frame);
  const that = this;
  window.addEventListener("message", function (e) {
    console.log("message2", e.origin, e.data);
    const data = JSON.parse(e.data);
    if (!data.auth) {
      return;
    }
    return that.handle_login(data.auth);
  });
};

Proto.detachedCallback = function () {
  if (!this.frame) {
    return;
  }
  this.frame.terminate();
};

Proto.onDestroy = function (pane) {
  this.pane = pane;
};

Proto.destroy = function () {
  if (!this.pane) {
    return;
  }
  this.pane.destroy();
  this.pane = null;
};

module.exports = document.registerElement("floobits-welcome_web_view", {prototype: Proto});
