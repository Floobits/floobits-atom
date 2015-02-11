/*jslint nomen: true, todo: true */
"use strict";

var util = require('util'),
  utils = require('./utils'),
  persistentjson = require("./persistentjson"),
  _ = require('lodash'),
  $$ = require("atom").$$,
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function (workspaces) {
  SelectListView.call(this);
  this.workspaces = workspaces;
};

utils.inherits(RecentWorkspaceView, SelectListView);

RecentWorkspaceView.prototype.initialize = function () {
  var pj, recent_workspaces, items;
  SelectListView.prototype.initialize.apply(this, arguments);

  this.addClass('overlay from-top');
  pj = new persistentjson.PersistentJson().load();
  recent_workspaces = _.pluck(pj.recent_workspaces, "url");
  this.items_ = {};
  items = recent_workspaces.map(function (workspace) {
    var p, stuff = utils.parse_url(workspace);
    try{
      p = pj.workspaces[stuff.owner][stuff.workspace].path;
    } catch(e) {
      p = "?";
    }
    this.items_[p] = workspace;
    return p;
  }, this);
  this.setItems(items);
  atom.workspace.addTopPanel({item: this});
  this.focusFilterEditor();
};

RecentWorkspaceView.prototype.viewForItem = function (path) {
  var items = this.items_;
  return $$(function () {
    var that = this;
    this.li({"class": 'two-lines'}, function () {
      that.div({"class": "primary-line file icon icon-file-text"}, path);
      that.div({"class": "secondary-line path no-icon"}, items[path]);
    });
  });
};

RecentWorkspaceView.prototype.confirmed = function (path) {
  var d = atom.project.getRootDirectory();
  
  console.log(util.format("%s was selected", path));
  this.cancel();

  if (d.getRealPathSync() === path) {
    return require("./floobits").floobits.join_workspace(this.items_[path]);
  }

  atom.config.set('floobits.atoms-api-sucks-url', this.items_[path]);
  atom.config.set('floobits.atoms-api-sucks-path', path);
  atom.open({pathsToOpen: [path], newWindow: false});
};

exports.RecentWorkspaceView = RecentWorkspaceView;
