/*global HTMLElement: true */

"use strict";

const Proto = Object.create(HTMLElement.prototype);

Proto.createdCallback = function () {
  this.component = document.createElement("webview");
  this.component.allowtransparency = "on";
};

Proto.attachedCallback = function () {
  this.appendChild(this.component);
};

Proto.detachedCallback = function () {
  if (!this.component) {
    return;
  }
  this.component.stop();
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

module.exports = document.registerElement("floobits-welcome_web_view", {prototype: Proto});