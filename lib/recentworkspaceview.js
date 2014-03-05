var util = require('util'),
  utils = require('./utils'),
  _ = require('lodash'),
  $$ = require('atom').$$,
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function(workspaces, cb) {
  this.workspaces = workspaces;
  this.cb = cb;
  SelectListView.apply(this);
};

utils.inherits(RecentWorkspaceView, SelectListView);

RecentWorkspaceView.prototype.initialize = function() {
  var self = this;
  SelectListView.prototype.initialize.apply(self, arguments);
  self.addClass('overlay from-top');
  self.setItems(self.workspaces);
};

RecentWorkspaceView.prototype.viewForItem = function(item) {
  return $$(function() {
    var self = this;
    this.li({"class": 'two-lines'}, function() {
      self.div({"class": "primary-line file icon icon-file-text"}, item.url);
      self.div({"class": "secondary-line path no-icon"}, item.path);
    });
  });
};

RecentWorkspaceView.prototype.confirmed = function(item) {
  console.log(util.format("%s was selected", item));
  this.cancel();
  this.cb(null, item);
};

RecentWorkspaceView.prototype.cancelled = function() {
  console.log("cancelled");
};

exports.RecentWorkspaceView = RecentWorkspaceView;
