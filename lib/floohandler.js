"use 6to5";
/*jslint nomen: true, todo: true */
"use strict";

var _ = require("lodash"),
  path = require("path"),
  fs = require("fs-extra"),
  async = require("async"),
  util = require("util"),
  listener = require("./listener"),
  flux = require("flukes"),
  floop = require("./floop"),
  messageAction = require("./common/message_action"),
  editorAction = require('./common/editor_action'),
  buffer = require("./common/buffer_model"),
  usersModel = require("./common/user_model"),
  Terminals = require("./common/terminal_model").Terminals,
  Filetree = require("./common/filetree_model"),
  prefs = require("./common/userPref_model"),
  perms = require("./common/permission_model"),
  atomRange = require('atom').Range,
  utils = require('./utils');


function FlooHandler(floourl, floorc, base_path) {
  var self = this, bufs, users, terminals, me, filetree;

  self.get_buf_cb = {};
  self.paths_to_ids = {};
  self.floourl = floourl;
  self.editors = {};
  self.base_path = base_path;
  self.floorc = floorc;
  self.ignore_events = false;
  self.send_patch_for = {};

  this.bufs = new buffer.Buffers();
  // editors = new editorModels.Editor([], bufs);
  // editors.createEditor();
  this.users = new usersModel.Users();
  this.terminals = new Terminals([], {users: users});
  this.me = new usersModel.User();
  this.filetree = new Filetree();

  editorAction.set(this.bufs, this.terminals, this.prefs);

  this.saveTimeout = null;
  this.lastHighlight = null;
}

FlooHandler.prototype.start = function () {
  var self = this, auth;

  atom.workspace.eachEditor(function (editor) {
    self.editors[editor.buffer.getPath()] = editor;
  });

  listener.onCHANGED(this.atom_changed.bind(this));
  listener.onSTOPPED_CHANGING(this.atom_stopped_changing.bind(this));
  listener.onSAVED(this.atom_saved.bind(this));
  listener.onCHANGED_SELECTION(this.atom_selected.bind(this));
  // listener.onCHANGED_CURSOR(this.atom_selected.bind(this));
  listener.onCHANGED_PATH(this.atom_renamed.bind(this));

  auth = this.floorc.auth[this.floourl.host];

  floop.onROOM_INFO(this.on_room_info.bind(this));
  floop.connect(this.floourl.host, this.floourl.port, {
    'username': auth.username,
    'secret': auth.secret,
    "path": util.format("%s/%s", this.floourl.owner, this.floourl.workspace),
    'client': "Atom",
    'platform': process.platform,
    'supported_encodings': ["utf8", "base64"],
    'version': "0.11"
  });
};

FlooHandler.prototype.stop = function () {
  var self = this;

  floop.disconnect();
};

FlooHandler.prototype.atom_saved = function (buffer) {
  var self = this,
    p = buffer.getPath(),
    buf = self.get_buf_by_path(p);

  if (!buf || !buf.buf || self.ignore_events) {
    return;
  }
  floop.send_saved({id: buf.id});
};

FlooHandler.prototype.atom_selected = function (editor, movedEvent) {
  var self = this, range, start, end,
    p = editor.getPath(),
    buf = self.get_buf_by_path(p),
    selections = editor.selections;

  if (selections.length <= 0) {
    return;
  }

  if (!buf || !buf.buf) {
    return;
  }

  floop.send_highlight({
    'id': buf.id,
    'ping': false,
    'summon': false,
    'following': false,
    'ranges': _.map(selections, function (selection){
      var range = selection.getBufferRange(),
        start = editor.buffer.characterIndexForPosition(range.start),
        end = editor.buffer.characterIndexForPosition(range.end);
      return [start, end];
    })
  });
};

FlooHandler.prototype.atom_destroyed = function (editor) {
  // delete self.editors[editor.buffer.getPath()];
};

FlooHandler.prototype.atom_stopped_changing = function(buffer) {
    var p,
    text,
    id,
    buf,
    patches,
    md5_before,
    patch_text,
    self = this,
    buffer_path = buffer.getPath();

  if (!floop.connected_ || !this.send_patch_for[buffer.floobits_id]) {
    return;
  }

  console.log("really changed");

  p = path.relative(this.base_path, buffer_path);
  id = this.paths_to_ids[p];
  if (!id) {
    return;
  }

  this.send_patch_for[buffer.floobits_id] = false;

  buf = this.bufs[id];
  if (!buf.buf) {
    // TODO: get buf
    return;
  }
  text = buffer.getText();
  patches = DMP.patch_make(buf.buf.toString(), text);
  patch_text = DMP.patch_toText(patches);

  buf.buf = new Buffer(text);
  md5_before = buf.md5;
  buf.md5 = utils.md5(buf.buf);
  if (md5_before === buf.md5){
    return;
  }

  floop.send_patch({
    id: id,
    md5_after: buf.md5,
    md5_before: md5_before,
    path: buf.path,
    patch: patch_text
  });
};

FlooHandler.prototype.atom_changed = function (buffer, change) {
  if (this.ignore_events) {
    return;
  }
  var p = path.relative(this.base_path, buffer.getPath());
  if (!this.paths_to_ids[p]) {
    return;
  }
  if (!buffer.floobits_id) {
    console.warn(buffer.getPath(), " is in project but not shared (and it changed).");
  }
  this.send_patch_for[buffer.floobits_id] = true;
};

FlooHandler.prototype.atom_renamed = function (editor) {
  console.log("atom rename", editor);
};

FlooHandler.prototype.user_id_to_name = function (id) {
  var self = this,
    user = self.users[id];

  return (user ? user.username : id);
};

FlooHandler.prototype.buf_id_to_path = function (id) {
  var self = this,
    buf = self.bufs[id];

  return (buf ? buf.path : '');
};

FlooHandler.prototype.send_get_buf = function (buf_id) {
  var self = this;
  floop.get_buf(buf_id);
  delete self.bufs[buf_id].buf;
};

FlooHandler.prototype.permsChanged = function () {
  var args = [];
  // if (perms.indexOf("kick") !== -1) {
  //   messageAction.log("You have permission to administer this workspace.");
  //   return;
  // }
  // if (perms.indexOf("patch") !== -1) {
  //   messageAction.log("You have permission to edit this workspace.");
  //   return;
  // }
  // if (perms.indexOf("request_perms") !== -1) {
  //   args.push({
  //     name: "Request edit permission",
  //     classNames: ["btn-warning"],
  //     action: function () {
  //       Socket.send_request_perms({
  //         perms: ["edit_room"]
  //       });
  //       // TODO: dismiss or change state or something
  //     }.bind(this)
  //   });
  // }
  // if (this.me.isAnon) {
  //   args.push({
  //     name: "Sign in",
  //     classNames: ["btn-primary"],
  //     action: fl.showLoginForm
  //   });
  // }
  // messageAction.interactive("You don't have permission to edit this workspace.", args);
};

FlooHandler.prototype.upsertUser = function (connection, opt_user, opt_myUserId) {
  var user, username, isMe = connection.user_id === opt_myUserId;
  username = connection.username;
  user = opt_user || new User();
  user.createConnection(connection.user_id, connection.client, connection.platform, connection.version, isMe);
  user.set({
    isMe: isMe,
    id: username,
    permissions: new flux.List(connection.perms),
    isAnon: connection.is_anon,
    gravatar: connection.gravatar,
  });
  return user;
};

FlooHandler.prototype.handle_temp_data = function (data) {
  if (!data.hangout || !data.hangout.url) {
    if (this.temp_data.hangout && this.temp_data.hangout.url) {
      messageAction.info("This workspace is no longer being edited in a Hangout");
    }
    return;
  }
  messageAction.interactive("This workspace is being edited in a Google Hangout", [
    {
      name: "Open Hangout",
      classNames: ["btn-success"],
      action: function () {
        self.location.href = data.hangout.url;
      }
    },
  ]);
};

FlooHandler.prototype.on_set_temp_data = function (data) {
  this.handle_temp_data(data.data);
  _.extend(this.temp_data, data.data);
};

FlooHandler.prototype.on_delete_temp_data = function (data) {
  this.handle_temp_data(data.data);
  _.each(data.data, function (k) {
    delete this.temp_data[k];
  }, this);
};

FlooHandler.prototype.on_room_info = function (workspace) {
  var self = this,
    open_editors = {},
    missing = [],
    conflicting = [],
    usersMap = {}, tree = {};

  usersMap[workspace.users[workspace.user_id].username] = this.me;
  this.me.myConnectionID = workspace.user_id;
  fl.username = workspace.users[workspace.user_id].username;
  console.log("room info", workspace);
  console.log("my user id", workspace.user_id);
  perms.set(workspace.perms, {silent: true});
  // TODO: very inefficient. causes a re-render of most of the UI next tick
  setTimeout(perms.update.bind(perms), 0);

  _.each(workspace.users, function (connection, id) {
    usersMap[connection.username] = this.upsertUser(connection, usersMap[connection.username], workspace.user_id);
  }, this);

  this.users.set(_.values(usersMap));
  this.filetree.tree = workspace.tree;

  _.each(workspace.bufs, function (buf, id) {
    this.bufs.add(buf);
  }, this);

  _.each(workspace.terms, function (term, termId) {
    var user = this.users.getByConnectionID(term.owner);
    this.terminals.addTerminal(termId, term.term_name, term.size[0], term.size[1], user.id);
  }, this);

  messageAction.success(`You have joined ${this.path_}.`, true);
  // if (!appHistory.start()) {
  //   editorAction.open_default_buf(this.filetree.tree);
  // }
  this.permsChanged();
  if (perms.indexOf("patch") === -1) {
    prefs.following = true;
    messageAction.info("Following changes because you don't have edit permission.");
  }
  // handlerAction.ready(workspace);

  this.temp_data = {};
  workspace.temp_data = workspace.temp_data || {};
  this.handle_temp_data(workspace.temp_data);
  this.temp_data = workspace.temp_data;

  console.log("starting syncing");

  // async.eachLimit(_.keys(d.bufs), 10, function (id, cb) {
  //   var file, md5, editor,
  //     buf = d.bufs[id],
  //     _path = path.join(self.base_path, buf.path);

  //   id = parseInt(id, 10);
  //   self.paths_to_ids[buf.path] = id;
  //   self.bufs[id] = buf;

  //   editor = self.editors[_path];
  //   if (editor) {
  //     file = editor.getText();
  //     md5 = utils.md5(file);
  //     buf.buf = new Buffer(file);
  //     if (buf.md5 !== md5) {
  //       console.log(util.format("%s is different: %s %s", _path, buf.md5, md5));
  //       conflicting.push(id);
  //     }
  //     return cb();
  //   }

  //   fs.readFile(_path, function (err, buffer) {
  //     if (err) {
  //       missing.push(id);
  //       return cb();
  //     }
  //     buf.buf = buffer;
  //     md5 = utils.md5(buffer);
  //     if (buf.md5 !== md5) {
  //       console.log(util.format("%s is different: %s %s", _path, buf.md5, md5));
  //       conflicting.push(id);
  //     }
  //     return cb();
  //   });
  // }, function (err) {
  //   _.each(missing, function (id) {
  //     self.send_get_buf(id);
  //   });
  //   _.each(conflicting, function (id) {
  //     self.send_get_buf(id);
  //   });
  //   console.log("done syncing");
  // });
};

FlooHandler.prototype.get_buf_by_path = function (_path) {
  var p = path.relative(this.base_path, _path),
    id = this.paths_to_ids[p];

  return this.bufs[id];
};

FlooHandler.prototype.on_get_buf = function (data) {
  var b = this.bufs.get(data.id);
  data.populated = true;
  b.set(data);
  clearTimeout(b.strike_timeout);

  // buf.buf = new Buffer(info.buf, info.encoding);
  // buf.md5 = info.md5;
  // self.bufs[buf.id] = buf;
  // cb = self.get_buf_cb[buf.id];
  // if (cb) {
  //   cb(buf.id);
  //   delete self.get_buf_cb[buf.id];
  //   return;
  // }
  // editor = this.editors[abs_path];
  // if (!editor) {
  //   fs.outputFileSync(abs_path, buf.buf);
  //   return;
  // }
  // self.ignore_events = true;
  // editor.setText(buf.buf.toString());
  // self.ignore_events = false;
};

FlooHandler.prototype.on_create_buf = function (buf) {
  var self = this,
    abs_path = path.join(self.listener.path, buf.path),
    dir = path.dirname(abs_path);

    // $(window), 'window:open-path'
    // application:open
    // 'application:open-dev'
  self.bufs[buf.id] = buf;
  self.paths_to_ids[buf.path] = buf.id;
  buf.buf = new Buffer(buf.buf, buf.encoding);
  fs.writeFileSync(abs_path, buf.buf);
};

FlooHandler.prototype.on_rename_buf = function (d) {
  var self = this,
    buf = self.bufs[d.id],
    old_path = buf.path;

  buf.path = d.path;
  // self.listener.rename(old_path, d.path);
};

FlooHandler.prototype.on_join = function (d) {
  var self = this;

  console.log(d.username + ' joined the room on ' + d.platform);
  self.users[d.user_id] = d;
};

FlooHandler.prototype.on_part = function (d) {
  console.log(d.username + ' joined the room');
};

FlooHandler.prototype.on_saved = function (d) {
  var self = this,
    username = self.user_id_to_name(d.user_id),
    _path = self.buf_id_to_path(d.id),
    abs_path = path.join(self.base_path, _path),
    editor = self.editors[abs_path];

  console.log(_path + ' was saved by ' + username);

  if (editor) {
    self.ignore_events = true;
    editor.buffer.save();
    self.ignore_events = false;
  }
  // TODO: write file out manually
};

FlooHandler.prototype.on_patch = function (d) {
  var self = this,
    buf = self.bufs[d.id],
    abs_path = path.join(self.base_path, buf.path),
    editor = self.editors[abs_path],
    clean_patch = true,
    i,
    md5_before,
    md5_after,
    patches,
    r,
    result,
    text,
    following;

  if (!buf.buf) {
    console.log("buf isn't populated. fetching");
    self.get_buf(buf.id);
    return;
  }
  md5_before = utils.md5(buf.buf);
  if (d.md5_before !== md5_before) {
    console.log("starting md5s don't match! ours:", md5_before, "patch's:", d.md5_before);
  }
  patches = DMP.patch_fromText(d.patch);
  if (_.isEmpty(patches)) {
    console.log("Got an empty set of patches.");
    return;
  }
  result = DMP.patch_apply(patches, buf.buf);
  text = result[0];
  for (i = 0; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  if (clean_patch === false) {
    // TODO: don't reset buf. ask the server to merge/rebase/whatever
    console.error("Couldn't apply patch. Getting buffer from server...", result);
    buf.buf = null;
    clearTimeout(buf.strike_timeout);
    self.send_get_buf(buf.id);
    return;
  }

  if (!editor) {
    fs.writeFileSync(abs_path, buf.buf);
    return;
  }

  self.ignore_events = true;
  _.each(result[2], function (patch) {
    var offset = patch[0],
      length = patch[1],
      replace = patch[2],
      start_pos = editor.buffer.positionForCharacterIndex(offset),
      end_pos = editor.buffer.positionForCharacterIndex(offset + length),
      r = new atomRange(start_pos, end_pos);
    console.log("replacing", start_pos, end_pos, replace);
    self.num_patches += 1;
    editor.buffer.setTextInRange(r, replace);
  });
  self.ignore_events = false;
  buf.buf = new Buffer(editor.buffer.getText());
  md5_after = utils.md5(buf.buf);
  buf.md5 = md5_after;

  clearTimeout(buf.strike_timeout);
  if (d.md5_after !== md5_after) {
    buf.strike_timeout = setTimeout(function () {
      console.log("strikeout triggered because after md5s were different");
      self.send_get_buf(buf.id);
    }, 1100);
  }
};

FlooHandler.prototype.on_delete_buf = function (d) {
  var self = this;
  // self.listener.delete_buf(d.path);
};

FlooHandler.prototype.on_error = function (d) {
  console.error(d);
};

FlooHandler.prototype.on_disconnect = function (d) {
  console.error('You were disconnected because', d.reason);
};

FlooHandler.prototype.on_highlight = function (d) {
  console.info("Highlight", d);
};

exports.FlooHandler = FlooHandler;
