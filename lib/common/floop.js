/* global */
/**
 * @fileOverview Connects to floobits via something.
 */

var EVENTS, actions,
  _ = require("lodash"),
  // messageAction = require("./editor/message_action"),
  flux = require("flukes"),
  // perms = require("./editor/permission_model"),
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
  ],
  OUT: [
    "auth",
    "create_buf",
    "datamsg",
    "delete_buf",
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
    "set_temp_data",
    "solicit",
    "term_stdin",
    "term_stdout",
    "webrtc",
  ]
};

_.each(EVENTS.OUT, function (name) {
  actions["send_" + name] = function actionOut (data, cb, that) {
    this.transport.write(name, data, cb, that);
    return data;
  };
});

function actionIn (data) {
  var req_id = data.req_id,
    f = reqCallbacks[req_id];

  if (f) {
    delete reqCallbacks[data.req_id];
    f(data);
  }
  return data;
}

_.each(EVENTS.IN, function (name) {
  actions[name] = actionIn;
});

actions.auth = function (auth) {
  return this.transport.write(null, auth);
};

actions.disconnect = function (msg) {
  if (this.transport) {
    this.transport.disconnect();
    this.transport = null;
  }

  this.disconnect_(msg);
  return msg;
};

actions.connect = function (transport, auth_blob) {
  var that = this;
  this.transport = transport;
  transport.connect();
  transport.on("connect", this.auth.bind(this, auth_blob));
  transport.on("message", function (name, data) {
    var f = that[name];
    if (f) {
      f(data);
    }
  });
};

actions.ping = function () {
  return this.transport.write("pong", {});
};

actions.send_get_buf = function (id, cb, that) {
  return this.transport.write("get_buf", {id: id}, cb, that);
};

/**
 * @param {*} data
 * @param {Array.<number>} to
 * @return {number} request id.
 */
actions.emitDataMessage = function (data, to) {
  console.log("emitting data message", data, to);
  return this.transport.write("datamsg", {
    data: data,
    to: to
  });
};

module.exports = new (flux.createActions(actions))();