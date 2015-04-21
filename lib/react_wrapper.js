/*jslint nomen: true, todo: true */
"use strict";
"use babel";

const _ = require("lodash");
const React = require("react-atom-fork");

const ELEMENTS = {};

const create_wrapper = function (name) {
  var Proto = Object.create(HTMLElement.prototype);

  Proto.init = function (component, styles) {
    this.reactNode = null;
    this.component = component;
    _.each(styles, function (v, k) {
      this.style[k] = v;
    }, this);
    return this;
  };

  Proto.createdCallback = function () {
  };

  Proto.attachedCallback = function () {
    this.reactNode = React.renderComponent(this.component, this);
  };

  Proto.attributeChangedCallback = function (attrName, oldVal, newVal) {
    return;
  };

  Proto.detachedCallback = function () {
    return;
  };

  Proto.onDestroy = function (pane) {
    this.pane = pane;
  };

  Proto.destroy = function () {
    if (!this.pane) {
      return;
    }
    this.pane.destroy();
    this.pane = null;
  };

  return document.registerElement(name, {prototype: Proto});
};

module.exports = {
  create_wrapper: create_wrapper,
  create_node: function (name, component, style) {
    var node;

    name = "floobits-" + name;
    if (name in ELEMENTS ) {
      node = new ELEMENTS[name]();
    } else {
      let Element = create_wrapper(name);
      ELEMENTS[name] = Element;
      node = new Element();
    }
    node.init(component, style);
    return node;
  },
};
