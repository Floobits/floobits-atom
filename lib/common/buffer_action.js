"use strict";

var flux = require("flukes");

const Actions = flux.createActions({
  changed: function (buf, constCharPointer, patches, username) {
    return [buf, constCharPointer || [buf.buf], patches, username];
  },
  deleted: function (buf, unlink) {
    return [buf, unlink];
  },
  saved: function (buf) {
    return buf;
  },
  rename: function (buf, oldPath, newPath) {
    return [buf, oldPath, newPath];
  },
  created: function (buf, username, connID) {
    return [buf, username, connID];
  },
  // pseudo event for on RI
  add: function (buf) {
    return buf;
  },
});

module.exports = new Actions();
