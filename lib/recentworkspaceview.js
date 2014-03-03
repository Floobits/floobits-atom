var util = require('util'),
  utils = require('./utils'),
  persistentjson = require("./persistentjson"),
  _ = require('lodash'),
  $$ = require('atom').$$,
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function(workspaces){
  SelectListView.apply(this);
  this.workspaces = workspaces;
};

utils.inherits(RecentWorkspaceView, SelectListView);

RecentWorkspaceView.prototype.initialize = function() {
  var self = this;
  SelectListView.prototype.initialize.apply(self, arguments);
  
  self.addClass('overlay from-top');
  // this.setMaxItems(20);
  var pj = new persistentjson.PersistentJson().load();

  self.setItems(_.pluck(pj.recent_workspaces, "url"));
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
