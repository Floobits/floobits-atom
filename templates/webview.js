/*global HTMLElement: true */

"use strict";

const _ = require("lodash");
const floorc = require("../common/floorc");
const message_action = require("../common/message_action");
const Pane = require("../../templates/pane");

const Proto = Object.create(HTMLElement.prototype);

Proto.createdCallback = function () {
  const frame = document.createElement("webview");
  frame.setAttribute("plugins", "on");
  frame.setAttribute("disablewebsecurity", "on");
  frame.setAttribute("allowPointerLock", 'on');
  frame.setAttribute("allowfileaccessfromfiles", 'on');
  frame.style.border = "0 none";
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.className = "native-key-bindings";

  frame.addEventListener("console-message",function (e) {
    let m = e.message;
    const prefix = "::atom-floobits-ipc::";
    if (!m.startsWith(prefix)) {
      return true;
    }
    m = m.slice(prefix.length);
    console.log(m);
    try {
      m = JSON.parse(m);
    } catch (e) {
      return true;
    }
    this.onCredentials(m.auth);
    return true;
  }.bind(this));
  this.frame = frame;
};

Proto.onCredentials = function (blob) {
  if (!_.has(floorc, "auth")) {
    floorc.auth = {};
  }

  const host = _.keys(blob)[0];
  const auth_data = blob[host];

  if (!_.has(floorc.auth, host)) {
    floorc.auth[host] = {};
  }

  const floorc_auth = floorc.auth[host];

  floorc_auth.username = auth_data.username;
  floorc_auth.api_key = auth_data.api_key;
  floorc_auth.secret = auth_data.secret;

  try {
    floorc.__write();
  } catch (e) {
    return message_action.error(e);
  }
};

Proto.load = function (host) {
  this.host = host;
  this.pane = new Pane("Floobits", "", this);
  atom.workspace.getActivePane().activateItem(this.pane);
  this.frame.src = `https://${host}/signup/atom?atomthing=true`;
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
    const data = JSON.parse(e.data);
    if (!data.auth) {
      return;
    }
    that.handle_login(data.auth);
  });
};

Proto.detachedCallback = function () {
  this.destroy();
};

Proto.destroy = function () {
  if (!this.pane) {
    return;
  }
  try {
    this.pane.destroy();
  } catch (e) {
    console.warn(e);
  }
  this.pane = null;
};

module.exports = document.registerElement("floobits-welcome_web_view", {prototype: Proto});
