/*jslint nomen: true, todo: true */
"use strict";

const utils = require("./utils");
const $$ = require("atom-space-pen-views").$$;
const SelectListView = require("atom-space-pen-views").SelectListView;

function DirectorySelectorView (directories, cb) {
  this.directories = directories;
  this.cb = cb;
  SelectListView.call(this);
}

utils.inherits(DirectorySelectorView, SelectListView);

DirectorySelectorView.prototype.initialize = function () {
  SelectListView.prototype.initialize.apply(this, arguments);

  this.setItems(this.directories);
  this.addClass("overlay from-top");
};

DirectorySelectorView.prototype.viewForItem = function (directory) {
  return $$(function () {
    this.li(directory.getBaseName());
  });
};

DirectorySelectorView.prototype.confirmed = function (directory) {
  console.log(`${directory} was selected`);
  this.cancel();
  return this.cb(null, directory);
};

module.exports = DirectorySelectorView;
