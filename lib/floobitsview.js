/*jslint nomen: true, todo: true */
"use strict";

var util = require('util'),
  utils = require('./utils'),
  _ = require('lodash'),
  View = require("atom").View;

var FloobitsView = function () {
  View.apply(this, arguments);
};

utils.inherits(FloobitsView, View);

FloobitsView.content = function (msg) {
  var self = this;
  return self.div({"class": "floobits overlay from-top"}, function () {
    return self.div(msg, {"class": "message"});
  });
};

exports.FloobitsView = FloobitsView;
