/* @flow weak */
/*global StringView, saveAs, $, _, fl */
"use strict";

var flux = require("flukes"), actions;

actions = flux.createActions({
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
  created: function () {

  },
});

module.exports = new actions();
