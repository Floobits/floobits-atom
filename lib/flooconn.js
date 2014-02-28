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

var FlooConn = function (host, port) {
  var self = this;
  
  events.EventEmitter.call(self);
  self.host = host;
  self.port = port;
  self.conn_buf = "";
  self.reconnect_timeout = null;
  self.reconnect_delay = 500;
};

util.inherits(FlooConn, events.EventEmitter);

FlooConn.prototype.connect = function () {
  var self = this;

  clearTimeout(self.reconnect_timeout);
  self.reconnect_timeout = null;

  self.conn_buf = "";

  self.conn = tls.connect(self.port, self.host, function () {
    self.connected = true;
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

FlooConn.prototype.reconnect = function () {
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

FlooConn.prototype.handle_msg = function (msg) {
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

FlooConn.prototype.data_handler = function (d) {
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

FlooConn.prototype.write = function (name, json) {
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
    self.conn.write(str);
    self.conn.write("\n");
  } catch (e) {
    debugger;
    log.error("error writing to client:", e, "disconnecting");
  }
};

exports.FlooConn = FlooConn;
