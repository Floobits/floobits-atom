/* @flow weak */
/** @jsx React.DOM */
/*global self, $, _, React, fl, Notification */
/** @fileOverview User preferences. */
"use strict";

var flux = require("flukes"),
  _ = require("lodash"),
  fieldTypes = flux.FieldTypes,
  prefs;

var UserPref = flux.createModel({
  // TODO: post prefs back to django
  // backend: flux.backends.local,
  followPaused: false,
  modelName: "UserPref",
  fieldTypes: {
    id: fieldTypes.string.defaults("UserPref"),
    theme: fieldTypes.string,
    sound: fieldTypes.bool.defaults(true),
    path: fieldTypes.string,
    following: fieldTypes.bool,
    followUsers: fieldTypes.list,
    logLevel: fieldTypes.number,
    showNotifications: fieldTypes.bool,
    showImages: fieldTypes.bool.defaults(true),
    dnd: fieldTypes.bool,
    mugshots: fieldTypes.bool,
    audioOnly: fieldTypes.bool,
    canNotify: fieldTypes.bool.ephemeral(),
  },
  // TODO: save as a user pref in django-land
  // getDefaultFields: function () {
  //   // var editorSettings = fl.editor_settings;
  //   return {
  //     theme: editorSettings.theme,
  //     sound: !!editorSettings.sound,
  //     following: !!editorSettings.follow_mode,
  //     logLevel: editorSettings.logLevel,
  //   };
  // },
  isFollowing: function (username) {
    if (this.followPaused) {
      return false;
    }
    if (_.isUndefined(username)) {
      if (this.followUsers.length > 0) {
        return true;
      }
      return this.following;
    }
    if(this.followUsers.indexOf(username) !== -1) {
      return true;
    }
    return this.following;
  },
  pauseFollowMode: function (duration) {
    var self = this;

    function resetFollowMode () {
      self.followPaused = false;
      delete self.pauseFollowTimeout;
    }

    if (!this.following && !this.followUsers.length) {
      return;
    }

    clearTimeout(this.pauseFollowTimeout);
    this.followPaused = true;
    this.pauseFollowTimeout = setTimeout(resetFollowMode, duration);
  },
  didUpdate: function (field) {
    if (_.isString(field) && field !== "showNotifications") {
      return;
    }
    if (_.isArray(field) && field.indexOf("showNotifications") === -1) {
      return;
    }
    this.requestNotificationPermission();
  },
  onNotificationPermission_: function (permission) {
    var canNotify = permission === "granted";

    if (canNotify === this.canNotify) {
      return;
    }
    this.set({canNotify: canNotify}, {silent: true});
    try {
      this.save();
    } catch (ignore) {}

  },
  requestNotificationPermission: function () {
    if (!self.Notification || !_.isFunction(Notification.requestPermission) || !this.showNotifications) {
      return;
    }
    Notification.requestPermission(this.onNotificationPermission_.bind(this));
  },
});

// prefs = new UserPref(fl.editor_settings);
prefs = new UserPref();
module.exports = prefs;
