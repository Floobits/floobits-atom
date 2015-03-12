"use babel";
/*jslint nomen: true, todo: true */
/*global fl */
"use strict";

const _ = require("lodash");
const path = require("path");
const fs = require("fs-extra");
const async = require("async");
const util = require("util");

const flux = require("flukes");
const floorc = require("../floorc");
const floop = require("../floop");
const constants = require("../constants");
const Transport = require("../../transport");

function AccountHandler(username, password, email) {
  this.username = username;
  this.password = password;
  this.email = email;
}

AccountHandler.prototype.start = function () {
  floop.onCREATE_USER(function (msg) {
    debugger;
    msg;
  });
  floop.onDISCONNECT(this.on_disconnect.bind(this));
  floop.onERROR(this.on_error.bind(this));
  floop.connect(new Transport(constants.HOST, constants.PORT), {
      name: 'create_user',
      username: this.username,
      password: this.password,
      email: this.email,
      version: constants.VERSION,
      client: "Atom",
      platform: process.platform,
    }
  );
};

AccountHandler.prototype.stop = function () {
  debugger;
  floop.disconnect();
  floop.off();
};

AccountHandler.prototype.on_disconnect = function (d) {
  debugger;
  console.error('You were disconnected because', d.reason);
};

AccountHandler.prototype.on_error = function (d) {
  debugger;
  console.error('You were disconnected because', d.reason);
};

module.exports = AccountHandler;
