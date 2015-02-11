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

// var React = require('react-atom-fork');
// var div = require('reactionary-atom-fork').div;
// var Component = React.createClass({
//   displayName: 'Floobits React Wrapper',
//   render: function () {
//     return div("asdf");
//   }
// });

// atom.workspace.addTopPanel({
//   item: create_node("asdf", Component(), ".floobits {color: red}"),
// });

exports.FloobitsView = FloobitsView;
