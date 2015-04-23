"use strict";

var flux = require("flukes");

const Actions = flux.createActions({
  changed: function (buf, constCharPointer, patches) {
    return [buf, constCharPointer || [buf.buf], patches];
  },
  deleted: function (buf, fromDisk) {
    return [buf, fromDisk];
  },
  saved: function (buf) {
    return buf;
  },
  rename: function (buf, oldPath, newPath) {
    return [buf, oldPath, newPath];
  },
  created: function (buf) {
    return buf;
  },
});

module.exports = new Actions();
