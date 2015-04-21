/*global HTMLElement: true */

"use strict";

const Proto = Object.create(HTMLElement.prototype);

Proto.createdCallback = function () {
  this.webview = document.createElement("webview");
  this.webview.allowtransparency = "on";
};

Proto.load = function (src) {
  this.webview.src = src;
};

Proto.attachedCallback = function () {
  const webview = this.webview;
  this.appendChild(this.webview);

  webview.addEventListener("console-message", function(e) {
    console.log("logged a message: ", e.level, e.message);
  });
  webview.addEventListener("did-finish-load", function () {
    console.log("finished loading", webview.getUrl());
  });
  webview.addEventListener("new-window", function (e) {
    console.log("new window", e.url);
  });
  webview.addEventListener("message", function (e) {
    console.log("message", e.origin, e.message);
  });
};

Proto.detachedCallback = function () {
  if (!this.webview) {
    return;
  }
  this.webview.terminate();
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