"use strict";

const util = require("util");
const tls = require("tls");
const CommonTransport = require("./common/transport");

function Transport(host, port) {
  CommonTransport.call(this);
  this.conn_ = null;
  this.conn_buf = "";
  this.host = host;
  this.port = port;
}

util.inherits(Transport, CommonTransport);

Transport.prototype.data_handler_ = function (d) {
  var msg, newline_index;

  this.conn_buf += d;

  newline_index = this.conn_buf.indexOf("\n");
  while (newline_index !== -1) {
    msg = this.conn_buf.slice(0, newline_index);
    this.conn_buf = this.conn_buf.slice(newline_index + 1);
    newline_index = this.conn_buf.indexOf("\n");
    msg = JSON.parse(msg);

    if (!msg.name) {
      continue;
    }

    this.emit("messaged", msg.name, msg);
  }
};

Transport.prototype.reconnect_ = function () {
  try {
    this.conn_.off();
    this.conn_.close();
  } catch (ignore) {
    // ignore
  }

  CommonTransport.prototype.reconnect_.call(this);
};

Transport.prototype.connect = function () {
  var that = this;

  that.conn_buf = "";
  that.conn_ = tls.connect({
    host: this.host,
    port: this.port,
  }, function () {
    that.emit("connected");
  });
  that.conn_.setEncoding("utf8");
  that.onEnd_ = function () {
    console.warn("socket is gone");
    that.emit("disconnected");
    that.reconnect_();
  };
  that.conn_.once("end", that.onEnd_);
  that.onData_ = function (data) {
    that.data_handler_(data);
  };
  that.conn_.on("data", that.onData_);
  that.onError_ = function (err) {
    console.error("Connection error:", err);
    that.emit("disconnected", err);
    that.reconnect_();
  };
  that.conn_.once("error", that.onError_);
};

Transport.prototype.disconnect = function (msg) {
  if (!this.conn_) {
    return msg;
  }

  CommonTransport.prototype.disconnect.call(this);

  try {
    this.conn_.removeListener("end", this.onEnd_);
    this.conn_.removeListener("data", this.onData_);
    this.conn_.removeListener("error", this.onError_);
    this.onEnd_ = null;
    this.onData_ = null;
    this.onError_ = null;
  } catch (e) {
    //ignore
  }

  try {
    this.conn_.end();
    this.conn_.destroy();
  } catch (e) {
    //ignore
  }

  this.conn_buf = "";
  this.conn_ = null;
  return msg;
};

Transport.prototype.write = function (name, msg, cb, context) {
  var str;

  if (!this.conn_) {
    return cb && cb("not connected");
  }

  if (name) {
    msg.name = name;
  }

  str = util.format("%s\n", JSON.stringify(msg));

  if (str.length > 1000) {
    console.info("writing to conn:", str.slice(0, 1000) + '...');
  } else {
    console.info("writing to conn:", str);
  }


  try {
    this.conn_.write(str, cb && cb.bind(context));
  } catch (e) {
    console.error("error writing to client:", e, "disconnecting");
  }
};

module.exports = Transport;
