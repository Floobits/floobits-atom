"use strict";

var util = require("util");

function FlooUrl(owner, workspace, host, port) {
  this.owner = owner;
  this.workspace = workspace;
  this.host = host;
  this.port = port;
}

FlooUrl.prototype.toAPIString = function () {
  return util.format("https://%s/api/room/%s/%s", this.host, this.owner, this.workspace);
};

FlooUrl.prototype.toString = function () {
  let port = parseInt(this.port, 10);
  return util.format("https://%s%s/%s/%s", this.host, port === 3448 ? "" : ":" + this.port, this.owner, this.workspace);
};

exports.FlooUrl = FlooUrl;
