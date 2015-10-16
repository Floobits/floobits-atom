"use strict";

var util = require("util");
var messageAction = require("./message_action");
var Emitter = require("./emitter");

var STARTING_TIMEOUT = 200;
var MAX_TIMEOUT = 10000;

function Transport() {
  Emitter.call(this);

  this.timeout = STARTING_TIMEOUT;
  this.reconnectTimeout = null;
  this.on("connected", this.reset_timeout.bind(this));
}

util.inherits(Transport, Emitter);

Transport.prototype.connect = function () {
  throw new Error("not implemented");
};

Transport.prototype.disconnect = function () {
  this.reconnectTimeout = clearTimeout(this.reconnectTimeout);
};

Transport.prototype.write = function (name, msg, cb, context) {
  console.debug(name, msg, cb, context);
  throw new Error("not implemented");
};

Transport.prototype.reset_timeout = function () {
  this.timeout = STARTING_TIMEOUT;
  this.reconnectTimeout = clearTimeout(this.reconnectTimeout);
};

Transport.prototype.reconnect_ = function () {
  if (this.reconnectTimeout) {
    return;
  }

  this.reconnectTimeout = setTimeout(function () {
    this.reconnectTimeout = null;
    this.connect();
  }.bind(this), this.timeout);
  messageAction.log(`Reconnecting in ${this.timeout}ms...`);
  this.timeout = Math.min(this.timeout * 2, MAX_TIMEOUT);
};

module.exports = Transport;
