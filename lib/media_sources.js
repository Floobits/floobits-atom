"use strict";

const $$ = require("atom-space-pen-views").$$;
const _ = require("lodash");

const utils = require("./utils");
const SelectListView = require("./select_list_view");

function MediaSources (sources, cb) {
  SelectListView.call(this, cb);
  this.sources = sources;
  const items = _.map(this.sources, function (source) {
    return source.label;
  });
  this.setItems(items);
}

utils.inherits(MediaSources, SelectListView);

MediaSources.prototype.viewForItem = function (label) {
  return $$(function () {
    this.li(label);
  });
};

MediaSources.prototype.confirmed = function (label) {
  const source = _.where(this.sources, {label: label})[0];
  SelectListView.prototype.confirmed.call(this, source);
};

module.exports = MediaSources;
