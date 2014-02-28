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
  self.conn = tls.connect(self.port, self.host, {rejectUnauthorized: false}, function () {
    self.connected = true;
    self.emit("connected");
  });
  self.conn.setEncoding('utf8');
  self.conn.on('end', function () {
    console.warn('socket is gone');
    self.reconnect();
  });
  self.conn.on('data', self.data_handler.bind(self));
  self.conn.on('error', function (err) {
    console.error('Connection error:', err);
    self.reconnect();
  });
};

FlooConn.prototype.stop = function() {
  if (self.conn) {
    try{
      self.conn.end();
      self.conn.destroy();  
    } catch (e) {}
    self.conn = null;
  }
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
  console.log('reconnecting in ', self.reconnect_delay);
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
    console.error("couldn't parse json:", msg, "error:", e);
    throw e;
  }
  console.info("calling", msg.name);
  self.emit(msg.name, msg);
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

FlooConn.prototype.write = function (json) {
  var self = this,
    str;

  if (!self.connected) {
    return;
  }

  str = util.format("%s\n", JSON.stringify(json));
  console.info("writing to conn:", str);
  try {
    self.conn.write(str);
  } catch (e) {
    console.error("error writing to client:", e, "disconnecting");
  }
};

exports.FlooConn = FlooConn;
