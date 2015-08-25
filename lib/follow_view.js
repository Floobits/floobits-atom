"use strict";
"use babel";

const $$ = require("atom-space-pen-views").$$;

const editorAction = require("./common/editor_action");
const prefs = require("./common/userPref_model");
const SelectListView = require("./select_list_view");
const utils = require("./utils");

var FollowView = function (me, users) {
  this.items_ = {};
  this.users = users;
  this.me = me;
  SelectListView.call(this);
};

utils.inherits(FollowView, SelectListView);

FollowView.prototype.initialize = function () {
  SelectListView.prototype.initialize.apply(this, arguments);
  this.addClass("overlay from-top");
  let myUsername = this.me.username;
  let items = this.users.map(function (u) {
    let username = u.username;
    this.items_[username] = prefs.followUsers.indexOf(username) !== -1;
    return u.username;
  }, this).filter(function (username) {
    return username !== myUsername;
  });
  items.unshift("floobits");
  this.items_.floobits = prefs.following;
  this.setItems(items);
};

FollowView.prototype.viewForItem = function (name) {
  var items = this.items_;
  return $$(function () {
    var that = this;
    this.li({"class": ""}, function () {
      that.div({"class": "primary-line icon icon-" + (items[name] ? "mute" : "unmute")}, (items[name] ? "unfollow " : "follow ") + name);
    });
  });
};

FollowView.prototype.confirmed = function (name) {
  SelectListView.prototype.confirmed.call(this, name);

  if (name === "floobits") {
    prefs.following = !prefs.following;
  } else {
    prefs.followUsers.toggle(name);
  }

  if (prefs.following || prefs.isFollowing(name)) {
    editorAction.jump_to_user(name);
  }
};

module.exports = FollowView;
