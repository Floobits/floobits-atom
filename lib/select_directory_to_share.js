"use strict";

const $$ = require("atom-space-pen-views").$$;

const utils = require("./utils");
const SelectListView = require("./select_list_view");

function DirectorySelectorView (directories, cb) {
  SelectListView.call(this, cb);
  this.setItems(directories);
}

utils.inherits(DirectorySelectorView, SelectListView);

DirectorySelectorView.prototype.viewForItem = function (directory) {
  return $$(function () {
    this.li(directory.getBaseName());
  });
};

module.exports = DirectorySelectorView;
