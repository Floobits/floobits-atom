"use strict";

const _ = require("lodash");
const flux = require("flukes");

const floop = require("./floop");

const Actions = flux.createActions({
  clear_highlights: function () {
    return;
  },
  handle_conflicts: function (newFiles, different, missing, ignored, tooBig, justUpload) {
    return {
      newFiles: newFiles,
      different: different,
      missing: missing,
      ignored: ignored,
      tooBig: tooBig,
      justUpload: justUpload
    };
  },
  jump_to_user: function (username) {
    return username;
  },
  kick: function (connectionIDorUsername) {
    let msg;
    if (_.isNumber(connectionIDorUsername)) {
      msg = {user_id: connectionIDorUsername};
    } else {
      msg = {username: connectionIDorUsername};
    }
    floop.send_kick(msg);
    return connectionIDorUsername;
  },
  pref: function (name, value, force) {
    if (this.prefs[name] === value && !force) {
      return new Error("Preference " + name + " already has value " + value);
    }
    this.prefs[name] = value;
    // XXXX: hard-coded fl.editor_settings.prefs_path
    this.prefs.save("editor");
    return [this.prefs, name];
  },
  follow: function (username) {
    let following;
    if (username) {
      following = this.prefs.followUsers.toggle(username);
    } else {
      following = this.prefs.following = !this.prefs.following;
    }
    this.prefs.save("editor");
    if (this.prefs.isFollowing()) {
      this.jump_to_user(username);
    }
    return following;
  },
});

Actions.prototype.set = function (buffers, prefs) {
  this.buffers = buffers;
  this.prefs = prefs;
};

module.exports = new Actions();
