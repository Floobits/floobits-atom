/* @flow weak */
/*global StringView, saveAs, $, _, fl */
"use strict";

var flux = require("flukes"),
  perms = require("./permission_model"),
  actions, line = null, lastOpenedBuffer = null;

actions = flux.createActions({
  handle_conflicts: function (newFiles, different, missing) {
    return [newFiles, different, missing]
  },
  highlight: function (bufferID, ranges, connectionID, username, summon) {
    var buf = this.buffers.get(bufferID);
    if (!buf) {
      return new Error("No buffer with id " + bufferID);
    }
    return [buf, ranges, connectionID, username, summon];
  },
  remove_highlight: function(connectionID) {
    return connectionID;
  },
  patch: function (bufferID, dmpPatchResult, newTextPointer) {
    return [bufferID, dmpPatchResult, newTextPointer];
  },
  kick: function (connectionIDorUsername) {
    return connectionIDorUsername;
  },
  open: function (bufferID, line_) {
    var buf = this.buffers.get(bufferID);
    if (!buf) {
      return new Error("No buffer with id " + bufferID);
    }
    lastOpenedBuffer = buf;
    line = line_;
    return [buf, line_];
  },
  open_term: function (id) {
    var term = this.terminals.get(id);
    if (!term) {
      return new Error("No terminal with id " + id + " was found");
    }
    return term;
  },
  close_term: function (id) {
    var term = this.terminals.get(id);
    if (!term) {
      return new Error("No terminal with id " + id + " was found");
    }
    return term;
  },
  close: function (bufferID) {
    var buf = this.buffers.get(bufferID);
    if (!buf) {
      return new Error("No buffer with id " + bufferID);
    }
    if (buf === lastOpenedBuffer) {
      lastOpenedBuffer = null;
    }
    return buf;
  },
  split_editor: function (type) {
    return type;
  },
  unsplit_editor: function () {
    return;
  },
  open_from_path: function (path) {
    var buffer;
    buffer = this.buffers.find(function (buffer) {
      return buffer.path === path;
    });
    if (!buffer) {
      return new Error("Buffer not found: " + path);
    }
    this.open(buffer.id);
    return buffer;
  },
  create_buf: function (path, buf, type, switchToBuf) {
    return [path, buf, type, switchToBuf];
  },
  created: function (buf) {
    return buf;
  },
  imagify: function (buf) {
    return buf;
  },
  new_file_prompt: function (pathPrefix) {
    return pathPrefix || "";
  },
  new_file: function (path) {
    var id;
    id = this.on(this.CREATED, function (buf) {
      if (buf.path === path) {
        this.open(buf.id);
        this.off(id);
      }
    }, this);
    return path;
  },
  delete_buf: function (bufferID) {
    return bufferID;
  },
  download: function () {
    var bufName ,data, encoding;
    if (!lastOpenedBuffer) {
      return;
    }
    bufName = lastOpenedBuffer.path.split("/").slice(-1)[0];
    data = lastOpenedBuffer.buf;
    encoding = "text/plain;charset=UTF-8";
    if (lastOpenedBuffer.encoding === "base64") {
      data = StringView.base64ToBytes(data);
      encoding = "application/octet-stream";
    }
    saveAs(new Blob([data], {type: encoding, endings: "transparent"}), bufName);
    return;
  },
  rename_prompt: function () {
    return;
  },
  /**
   * @param {number} bufferId
   * @return {string}
   */
  start_rename_prompt: function (bufferId) {
    var buffer = this.buffers.get(bufferId);
    if (!buffer) {
      return new Error("Couldn't find buffer for buffer id: " + bufferId);
    }
    return buffer.path;
  },
  /**
   * @param {string} newPath
   * @return {string}
   */
  rename_request: function (newPath) {
    if (!lastOpenedBuffer) {
      return;
    }
    lastOpenedBuffer.path = newPath;
    this.rename(lastOpenedBuffer);
    this.open(lastOpenedBuffer.id, line);
    return [lastOpenedBuffer, newPath];
  },
  rename: function (buf) {
    return buf;
  },
  fullscreen: function () {
    return;
  },
  follow: function (username) {
    if (username) {
      this.prefs.followUsers.toggle(username);
      return this.pref("followUsers", this.prefs.followUsers, true);
    }
    return this.pref("following", !this.prefs.following);
  },
  summon: function () {
    return;
  },
  request_perms: function () {
    return;
  },
  pref: function (name, value, force) {
    if (this.prefs[name] === value && !force) {
      return new Error("Preference " + name + " already has value " + value);
    }
    this.prefs[name] = value;
    this.prefs.save(fl.editor_settings.prefs_path);
    return [this.prefs, name];
  },
  pull_repo: function (repoType, repoURL) {
    return [repoType, repoURL];
  },
  upload: function () {
    return;
  },
  //Open a default buf if one exists.
  open_default_buf: function (filetree) {
    var keys, i, buffer, README, textfile, dirs = [], leaf;
    keys = Object.keys(filetree);
    for (i = 0; i < keys.length; i++) {
      leaf = filetree[keys[i]];
      if (_.isNumber(leaf)) {
        buffer = this.buffers.get(leaf);
        if (buffer.path.split("/").pop().indexOf("README") !== -1) {
          this.open(buffer.id);
          return true;
        }
        if (!textfile && buffer.encoding === "utf8") {
          textfile = buffer;
        }
      } else {
        dirs.push(leaf);
      }
    }
    if (textfile) {
      this.open(textfile.id);
      return true;
    }
    for (i = 0; i < dirs.length; i++) {
      if (this.open_default_buf(dirs[i])) {
        return;
      }
    }
    return false;
  },
});

actions.prototype.set = function (buffers, terminals, prefs) {
  this.buffers = buffers;
  this.terminals = terminals;
  this.prefs = prefs;
};

module.exports = new actions();
