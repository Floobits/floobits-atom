/*jslint nomen: true, todo: true */
"use strict";

const util = require("util");
const utils = require("./utils");
const _ = require("lodash");
const $$ = require("atom-space-pen-views").$$;
const SelectListView = require("atom-space-pen-views").SelectListView;

function DirectorySelectorView (directories) {
  this.directories = directories;
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

DirectorySelectorView.prototype.confirmed = function (path) {
  // var d = atom.project.getRootDirectory();

  console.log(util.format("%s was selected", path));
  this.cancel();
  return;
  // if (d && d.getRealPathSync() === path) {
  //   return require("./floobits").join_workspace(this.items_[path]);
  // }

  atom.config.set("floobits.atoms-api-sucks-url", this.items_[path]);
  atom.config.set("floobits.atoms-api-sucks-path", path);
  atom.open({pathsToOpen: [path], newWindow: true});
};

module.exports = DirectorySelectorView;
