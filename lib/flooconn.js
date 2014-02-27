var events = require("events"),
  fs = require("fs"),
  net = require("net"),
  path = require("path"),
  tls = require("tls"),
  util = require("util");

var _ = require("lodash");
var DMP = require("diff_match_patch");
var log = require("floorine");

var utils = require("./utils");


var CLIENT = "atom";
var __VERSION__ = "0.03";

var FlooConnection = function (floourl, floorc) {
  var self = this;
  
  events.EventEmitter.call(self);

  self.conn_buf = "";
  self.reconnect_timeout = null;
  self.reconnect_delay = 500;
};

util.inherits(FlooConnection, events.EventEmitter);

FlooConnection.prototype.user_id_to_name = function (id) {
  var self = this,
    user = self.users[id];

  return (user ? user.username : id);
};

FlooConnection.prototype.buf_id_to_path = function (id) {
  var self = this,
    buf = self.listener.bufs[id];

  return (buf ? buf.path : '');
};

FlooConnection.prototype.connect = function () {
  var self = this;

  clearTimeout(self.reconnect_timeout);
  self.reconnect_timeout = null;

  self.conn_buf = "";

  self.conn = tls.connect(self.floourl.port, self.floourl.host, function () {
    self.emit("connected");
  });
  self.conn.on('end', function () {
    log.warn('socket is gone');
    self.reconnect();
  });
  self.conn.on('data', self.data_handler.bind(self));
  self.conn.on('error', function (err) {
    log.error('Connection error:', err);
    self.reconnect();
  });
};

FlooConnection.prototype.reconnect = function () {
  var self = this;

  if (self.reconnect_timeout) {
    return;
  }
  self.users = {};
  self.perms = [];
  self.connected = false;
  self.reconnect_timeout = setTimeout(self.connect.bind(self), self.reconnect_delay);
  self.reconnect_delay = Math.min(10000, Math.floor(1.5 * self.reconnect_delay));
  log.log('reconnecting in ', self.reconnect_delay);
  try {
    self.conn.close();
  } catch (ignore) {
  }
};

FlooConnection.prototype.handle_msg = function (msg) {
  var self = this;

  try {
    msg = JSON.parse(msg);
  } catch (e) {
    log.error("couldn't parse json:", msg, "error:", e);
    throw e;
  }
  log.debug("calling", msg.name);
  self.emit('on_' + msg.name, msg);
};

FlooConnection.prototype.data_handler = function (d) {
  var self = this,
    msg,
    newline_index;
    
  self.conn_buf += d;

  newline_index = self.conn_buf.indexOf("\n");
  while (newline_index !== -1) {
    msg = self.conn_buf.slice(0, newline_index);
    self.conn_buf = self.conn_buf.slice(newline_index + 1);
    self.handle_msg(msg);
    newline_index = self.conn_buf.indexOf("\n");
  }
};

FlooConnection.prototype.write = function (name, json) {
  var self = this,
    str;

  if (!self.connected) {
    return;
  }
  if (name) {
    json.name = name;
  }
  str = JSON.stringify(json);
  log.debug("writing to conn:", str);
  try {
    self.conn.write(str + "\n");
  } catch (e) {
    log.error("error writing to client:", e, "disconnecting");
    process.exit(1);
  }
};

module.exports = FlooConnection;
