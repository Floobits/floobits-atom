/*jslint nomen: true, todo: true */
"use strict";

var util = require('util');

var _ = require("lodash");
var React = require('react-atom-fork');


var create_wrapper = function (name) {
  name = 'floobits-' + name;

  var ReactWrapper = function () {
    // Never called
    return;
  };

  util.inherits(ReactWrapper, HTMLElement);

  ReactWrapper.prototype.init = function (component, styles) {
    this.reactNode = null;
    this.component = component;

    this.styleElem = document.createElement('style');
    this.styleElem.textContent = styles;
    this.styleElem.setAttribute('context', name);

    this.root = document.createElement('div');
    this.root.classList.add('floobits');

    this.shadow = this.createShadowRoot();
    this.shadow.appendChild(this.styleElem.cloneNode(true)); // TODO: figure out why we're cloning this node
    this.shadow.appendChild(this.root);

    return this;
  };

  ReactWrapper.prototype.createdCallback = function () {
    return;
  };

  ReactWrapper.prototype.attachedCallback = function () {
    this.reactNode = React.renderComponent(this.component, this.root);
  };

  ReactWrapper.prototype.attributeChangedCallback = function (attrName, oldVal, newVal) {
    return;
  };

  ReactWrapper.prototype.detachedCallback = function () {
    return;
  };

  return document.registerElement(name, {prototype: ReactWrapper.prototype});
};

module.exports = {
  create_wrapper: create_wrapper,
  create_node: function (name, component, style) {
    var node = new (create_wrapper(name))();
    node.init(component, style);
    return node;
  },
};
