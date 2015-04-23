"use strict";

const utils = require("./utils");
const _ = require("lodash");
const $$ = require("atom").$$;
const SelectListView = require("atom").SelectListView;

function MediaSources (sources, cb) {
  this.cb = cb;
  this.sources = sources;
  SelectListView.call(this);
}

utils.inherits(MediaSources, SelectListView);

MediaSources.prototype.initialize = function () {
  SelectListView.prototype.initialize.apply(this, arguments);
  this.addClass("overlay from-top");
  const items = _.map(this.sources, function (source) {
    return source.label;
  });
  this.setItems(items);
};

MediaSources.prototype.viewForItem = function (label) {
  return $$(function () {
    this.li(label);
  });
};

MediaSources.prototype.confirmed = function (label) {
  this.cancel();
  const source = _.where(this.sources, {label: label})[0];
  this.cb(source);
};

module.exports = MediaSources;
