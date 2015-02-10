"use 6to5";
/* @flow weak */
"use strict";

var Message,
  Messages,
  LEVEL,
  LEVEL_TO_STRING = {},
  id = 0,
  _ = require("lodash"),
  flux = require("flukes"),
  utils = require("../utils");

LEVEL = {
  INFO: 0,
  SUCCESS: 1,
  WARNING: 2,
  ERROR: 3,
};

_.each(LEVEL, function (v, k) {
  LEVEL_TO_STRING[v] = k.toLowerCase();
});

/**
 * @param {Object} data
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 * @constructor
 */

Message = flux.createModel({
  modelName: "Message",
  fieldTypes: {
    id: flux.FieldTypes.number,
    username: flux.FieldTypes.string,
    msg: flux.FieldTypes.string,
    type: flux.FieldTypes.string,
    level: flux.FieldTypes.number,
    time: flux.FieldTypes.number,
    buttons: flux.FieldTypes.collection,
  },
  getDefaultFields: function () {
    return {
      id: ++id,
      time: Date.now()
    };
  },
});

Object.defineProperty(Message.prototype, "levelName", {
  get: function () {
    return LEVEL_TO_STRING[this.level];
  }
});

Object.defineProperty(Message.prototype, "prettyTime", {
  get: function () {
    var d = utils.formatDate(new Date(this.time));
    return `${d.hour}:${d.minute} ${d.meridian}`;
  }
});

Messages = flux.createCollection({
  modelName: "Messages",
  model: Message,
  didUpdate: function () {
    // Limit to 1k messages max
    this.splice(1000);
  }
});

module.exports = {
  LEVEL: LEVEL,
  Message: Message,
  Messages: Messages,
};
