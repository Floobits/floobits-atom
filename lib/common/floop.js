/* global */
"use strict";

/**
 * @fileOverview Connects to floobits via something.
 */

let authorized = false;

const _ = require("lodash");
const flux = require("flukes");
const perms = require("./permission_model");

var EVENTS, actions,
  // messageAction = require("./editor/message_action"),
  reqCallbacks = {};

actions = {
  socket_: null,
  capturedEvents: null,
  captureEvents: null,
  requestId: 0,
  reconnectTimeout: null,
  engineIoURL: null
};

EVENTS = {
  IN: [
    "ack",
    "create_buf",
    "create_term",
    "datamsg",
    "delete_buf",
    "delete_temp_data",
    "delete_term",
    "error",
    "get_buf",
    "highlight",
    "join",
    "kick",
    "msg",
    "part",
    "patch",
    "perms",
    "ping",
    "pong",
    "rename_buf",
    "request_perms",
    "room_info",
    "saved",
    "set_temp_data",
    "solicit",
    "sync",
    "term_stdin",
    "term_stdout",
    "update_term",
    "user_info",
    "webrtc",
    // TODO: something better than all events for all connections
    "create_user"
  ],
  OUT: [
    "auth",
    "create_buf",
    "create_term",
    "datamsg",
    "delete_buf",
    "delete_term",
    "delete_temp_data",
    "get_buf",
    "highlight",
    "kick",
    "msg",
    "patch",
    "perms",
    "ping",
    "pong",
    "pull_repo",
    "rename_buf",
    "request_perms",
    "saved",
    "set_buf",
    "set_temp_data",
    "solicit",
    "term_stdin",
    "term_stdout",
    "update_term",
    "webrtc",
  ]
};

_.each(EVENTS.OUT, function (name) {
  actions["send_" + name] = function actionOut (data, on_write, on_response) {
    const err = this.send_(name, data, on_write, on_response);
    return err || data;
  };
});

function actionIn (data) {
  var id = data.res_id,
    f = reqCallbacks[id];

  if (!f) {
    return data;
  }
  delete reqCallbacks[id];
  if (data.name === "error") {
    console.error(data.msg);
    f(data);
    return data;
  }
  f(null, data);
  return data;
}

_.each(EVENTS.IN, function (name) {
  actions[name] = actionIn;
});

actions.auth = function (auth) {
  this.connected = true;
  return this.transport.write(null, auth);
};

actions.disconnect = function (msg) {
  authorized = false;
  if (!this.transport) {
    return msg;
  }
  try {
    this.transport.removeListener("connected", this.onConnected_);
    this.transport.removeListener("disconnected", this.onDisconnected_);
    this.transport.removeListener("messaged", this.onMessaged_);
  } catch (e) {
    // Unused
  }

  try {
    this.transport.disconnect();
    this.transport = null;
  } catch (e) {
    // Unused
  }

  return msg;
};

actions.connect = function (transport, auth_blob) {
  var that = this;
  this.transport = transport;
  transport.connect();
  that.onConnected_ = this.auth.bind(this, auth_blob);
  transport.on("connected", that.onConnected_);
  that.onDisconnected_ = function () {
    that.connected = false;
    authorized = false;
  };
  transport.on("disconnected", that.onDisconnected_);
  that.onMessaged_ = function (name, data) {
    if (name === "room_info") {
      console.log("Now authorized.");
      authorized = true;
    }

    const f = that[name];
    if (f) {
      f(data);
    }
  };
  transport.on("messaged", that.onMessaged_);
};

actions.ping = function () {
  if (!this.transport) {
    console.log("There is no socket to send with. We are currently disconnected.");
    return;
  }
  this.transport.write("pong", {});
};

actions.send_get_buf = function (id, on_response) {
  return this.send_("get_buf", {id: id}, null, on_response);
};

/**
 * @param {*} data
 * @param {Array.<number>} to
 * @return {number} request id.
 */
actions.emitDataMessage = function (data, to) {
  console.log("emitting data message", data, to);
  if (!this.transport) {
    console.log("There is no socket to send with. We are currently disconnected.");
    return;
  }
  this.transport.write("datamsg", {
    data: data,
    to: to
  });
};

actions.connected = false;

let Actions = flux.createActions(actions);

Actions.prototype.send_ = function (name, data, on_write, on_response) {
  if (!this.transport) {
    console.log("There is no socket to send with. We are currently disconnected.");
    return new Error("Floobits is not connected to a workspace.");
  }

  if (name !== "auth" && !authorized) {
    console.log("Not authorized yet.");
    return new Error("You are not authorized to do that (yet, maybe).");
  }

  if (!("req_id" in data || "res_id" in data)) {
    data.req_id = ++this.requestId;
  }

  if (name && perms.indexOf(name) === -1) {
    console.error("OMG no permission to send", name);
    return new Error("You don't have permission to do that (%s)." % (name));
  }

  this.transport.write(name, data, on_write);

  if (on_response) {
    reqCallbacks[data.req_id] = on_response;
  }
};

module.exports = new Actions();
