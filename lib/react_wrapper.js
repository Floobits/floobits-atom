/*jslint nomen: true, todo: true */
"use strict";

var _ = require("lodash");
var React = require('react-atom-fork');

var utils = require('./utils');


var create_node = function (name) {
  name = 'floobits-' + name;

  var base = function () {

  };
  utils.inherits(base, HTMLElement);

  var BaseReactWrapper = document.registerElement(name, {prototype: base.prototype});

  var ReactWrapper = function (component, styles) {
    // BaseReactWrapper.call(this);

    this.reactNode = null;
    this.component = component;

    this.styleElem = document.createElement('style');
    // ".floobits {color: red}";
    this.styleElem.textContent = styles;
    this.styleElem.setAttribute('context', name);

    this.root = document.createElement('div');
    this.root.classList.add('floobits');
  };

  utils.inherits(ReactWrapper, BaseReactWrapper);

  ReactWrapper.prototype.createdCallback = function () {
    this.shadow = this.createShadowRoot();
    // TODO: figure out why we're cloning this node
    this.shadow.appendChild(this.styleElem.cloneNode(true));
    this.shadow.appendChild(this.root);
    this.reactNode = React.renderComponent(this.component, this.root);
  };

  ReactWrapper.prototype.attachedCallback = function () {
    return;
  };

  ReactWrapper.prototype.attributeChangedCallback = function (attrName, oldVal, newVal) {
    return;
  };

  ReactWrapper.prototype.detachedCallback = function () {
    return;
  };

  return ReactWrapper;
};

module.exports = create_node;
