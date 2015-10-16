"use strict";
"use babel";

const $$ = require("atom-space-pen-views").$$;

const editorAction = require("./common/editor_action");
const prefs = require("./common/userPref_model");
const SelectListView = require("./select_list_view");
const utils = require("./utils");
const EVERYONE = "all changes";

var FollowView = function (me, users) {
  this.items_ = {};
  this.users = users;
  this.me = me;
  SelectListView.call(this);
};

utils.inherits(FollowView, SelectListView);

FollowView.prototype.initialize = function () {
  SelectListView.prototype.initialize.apply(this, arguments);
  this.addClass("modal overlay from-top");
  let myUsername = this.me.username;
  let items = this.users.map(function (u) {
    let username = u.username;
    this.items_[username] = prefs.followUsers.indexOf(username) !== -1;
    return u.username;
  }, this).filter(function (username) {
    return username !== myUsername;
  });
  items.unshift(EVERYONE);
  this.items_[EVERYONE] = prefs.following;
  this.setItems(items);
};

FollowView.prototype.viewForItem = function (name) {
  var items = this.items_;
  return $$(function () {
    var that = this;
    this.li({"class": ""}, function () {
      that.div({"class": "primary-line icon icon-" + (items[name] ? "mute" : "unmute")}, (items[name] ? "Stop following " : "Follow ") + name);
    });
  });
};

FollowView.prototype.confirmed = function (name) {
  SelectListView.prototype.confirmed.call(this, name);
  if (name === EVERYONE) {
    name = "";
  }
  editorAction.follow(name);
};

module.exports = FollowView;
