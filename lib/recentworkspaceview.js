/*jslint nomen: true, todo: true */
"use strict";

var util = require('util'),
  utils = require('./utils'),
  persistentjson = require("./persistentjson"),
  _ = require('lodash'),
  $$ = require('atom').$$,
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function (workspaces){
  SelectListView.apply(this);
  this.workspaces = workspaces;
};

utils.inherits(RecentWorkspaceView, SelectListView);

RecentWorkspaceView.prototype.initialize = function () {
  var self = this, pj, recent_workspaces, items;
  SelectListView.prototype.initialize.apply(self, arguments);

  self.addClass('overlay from-top');
  pj = new persistentjson.PersistentJson().load();
  recent_workspaces = _.pluck(pj.recent_workspaces, "url");
  items = recent_workspaces.map(function (workspace) {
    var p, stuff = utils.parse_url(workspace);
    try{
      p = pj.workspaces[stuff.owner][stuff.workspace].path;
    } catch(e) {
      p = "?";
    }
    return {
      path: p,
      url: workspace
    };
  });
  self.setItems(items);
  atom.workspaceView.append(this);
  self.focusFilterEditor();
};

RecentWorkspaceView.prototype.viewForItem = function (item) {
  return $$(function () {
    var self = this;
    this.li({"class": 'two-lines'}, function () {
      self.div({"class": "primary-line file icon icon-file-text"}, item.url);
      self.div({"class": "secondary-line path no-icon"}, item.path);
    });
  });
};

RecentWorkspaceView.prototype.confirmed = function (item) {
  console.log(util.format("%s was selected", item));
  atom.config.set('floobits.atoms-api-sucks-path', item.path);
  atom.config.set('floobits.atoms-api-sucks-url', item.url);
  atom.open({pathsToOpen: [item.path]});
  this.cancel();
};

RecentWorkspaceView.prototype.cancelled = function () {
  console.log("cancelled");
};

exports.RecentWorkspaceView = RecentWorkspaceView;
