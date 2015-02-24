/*jslint nomen: true, todo: true */
"use strict";

var util = require('util');

var _ = require("lodash");
var React = require('react-atom-fork');


var create_wrapper = function (name, options) {
  name = 'floobits-' + name;
  var options = options || {};

  var ReactWrapper = function () {
    // Never called
    return;
  };

  util.inherits(ReactWrapper, HTMLElement);

  ReactWrapper.prototype.init = function (component, styles) {
    this.reactNode = null;
    this.component = component;
    _.each(styles, function (v, k) {
      this.style[k] = v;
    }, this);
    return this;
  };

  ReactWrapper.prototype.createdCallback = function () {
  };

  ReactWrapper.prototype.attachedCallback = function () {
    this.reactNode = React.renderComponent(this.component, this);
  };

  ReactWrapper.prototype.attributeChangedCallback = function (attrName, oldVal, newVal) {
    return;
  };

  ReactWrapper.prototype.detachedCallback = function () {
    return;
  };


  ReactWrapper.prototype.getTitle = function (){
    return options.title || name;
  };

  ReactWrapper.prototype.getLongTitle = function (){
    return options.LongTitle || name;
  };

  return document.registerElement(name, {prototype: ReactWrapper.prototype});
};

module.exports = {
  create_wrapper: create_wrapper,
  create_node: function (name, options, component, style) {
    var node = new (create_wrapper(name, options))();
    node.init(component, style);
    return node;
  },
};
