var util = require('util'),
  utils = require('./utils'),
  _ = require('lodash'),
  $$ = require('atom').$$,
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function(){
  SelectListView.apply(this, arguments);
};

utils.inherits(RecentWorkspaceView, SelectListView);

RecentWorkspaceView.prototype.initialize = function() {
  var self = this;
  SelectListView.prototype.initialize.apply(self, arguments);
  
  self.addClass('overlay from-top');
  self.setItems(['Hello', 'World']);
  atom.workspaceView.append(this);
  self.focusFilterEditor();
};

RecentWorkspaceView.prototype.viewForItem = function(item) {
  // return "<li><div>" + item + "</div></li>";
  return $$(function() {
    var self = this;
    this.li(function() {
      self.div(item);
    });
  });
};

RecentWorkspaceView.prototype.confirmed = function(item) {
  console.log(util.format("%s was selected", item));
  this.cancel();
};

RecentWorkspaceView.prototype.cancelled = function() {
  console.log("cancelled");
};

exports.RecentWorkspaceView = RecentWorkspaceView;
