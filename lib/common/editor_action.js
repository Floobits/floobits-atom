/* @flow weak */
/*global StringView, saveAs, $, _, fl */
"use babel";
"use strict";

let flux = require("flukes");

let actions = flux.createActions({
  handle_conflicts: function (newFiles, different, missing, ignored, tooBig) {
    return {
      newFiles: newFiles,
      different: different,
      missing: missing,
      ignored: ignored,
      tooBig: tooBig
    };
  },
  jump_to_user: function (username) {
    return username;
  },
  kick: function (connectionIDorUsername) {
    return connectionIDorUsername;
  },
  pref: function (name, value, force) {
    if (this.prefs[name] === value && !force) {
      return new Error("Preference " + name + " already has value " + value);
    }
    this.prefs[name] = value;
    this.prefs.save(fl.editor_settings.prefs_path);
    return [this.prefs, name];
  },
});

module.exports = new actions();
