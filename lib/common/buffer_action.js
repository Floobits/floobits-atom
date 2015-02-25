/* @flow weak */
/*global StringView, saveAs, $, _, fl */
"use strict";

var flux = require("flukes"), actions;

actions = flux.createActions({
  changed: function (buf) {
    return buf;
  },
  deleted: function (buf, fromDisk) {
    return [buf, fromDisk];
  },
  saved: function (buf) {
    return buf;
  },
  moved: function () {

  },
  created: function () {

  },
});

module.exports = new actions();
