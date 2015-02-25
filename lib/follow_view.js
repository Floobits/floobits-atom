/*jslint nomen: true, todo: true */
"use 6to5";
"use strict";

var  _ = require('lodash'),
  utils = require('./utils'),
  prefs = require("./common/userPref_model"),
  $$ = require("atom").$$,
  SelectListView = require("atom").SelectListView;

var FollowView = function (me, users) {
  this.items_ = {};
  this.users = users;
  this.me = me;
  SelectListView.call(this);
};

utils.inherits(FollowView, SelectListView);

FollowView.prototype.initialize = function () {
  SelectListView.prototype.initialize.apply(this, arguments);
  this.addClass('overlay from-top');
  let myUsername = this.me.username;
  let items = this.users.map(function (u) {
    let username = u.username;
    this.items_[username] = prefs.followUsers.indexOf(username) !== -1;
    return u.username;
  }, this).filter(function (username) {
    return username !== myUsername;
  });
  items.unshift("everyone");
  this.items_.everyone = prefs.following;
  this.setItems(items);
};

FollowView.prototype.viewForItem = function (name) {
  var items = this.items_;
  return $$(function () {
    var that = this;
    this.li({"class": ''}, function () {
      that.div({"class": "primary-line icon icon-" + (items[name] ? "mute" : "unmute")}, (items[name] ? "unfollow " : "follow ") + name);
    });
  });
};

FollowView.prototype.confirmed = function (name) {
  if (name === "everyone") {
    prefs.following = !prefs.following;
  } else {
    prefs.followUsers.toggle(name);
  }
  this.cancel();
};

module.exports = FollowView;
