"use strict";
"use babel";

const AtomSelectListView = require("atom-space-pen-views").SelectListView;

const utils = require("./common/utils");


function SelectListView (cb) {
  this.cb = cb;
  AtomSelectListView.call(this);
  // this nextTick is needed for some reason... :(
  process.nextTick(function () {
    this.panel = atom.workspace.addModalPanel({item: this});
    this.storeFocusedElement();
    this.focusFilterEditor();
  }.bind(this));
}

utils.inherits(SelectListView, AtomSelectListView);

SelectListView.prototype.initialize = function () {
  AtomSelectListView.prototype.initialize.apply(this, arguments);
  this.addClass("overlay from-top");
};

SelectListView.prototype.cancel = function () {
  AtomSelectListView.prototype.cancel.apply(this);
  this.panel && this.panel.destroy();
};

SelectListView.prototype.confirmed = function (arg) {
  console.debug(`${arg} selected`);
  this.cb && this.cb(null, arg);
  this.cancel();
};

module.exports = SelectListView;
