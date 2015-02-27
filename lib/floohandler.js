"use 6to5";
/*jslint nomen: true, todo: true */
/*global fl */
"use strict";

var _ = require("lodash"),
  path = require("path"),
  fs = require("fs-extra"),
  async = require("async"),
  util = require("util"),
  AtomListener = require("./atom_listener"),
  flux = require("flukes"),
  floorc = require("./common/floorc"),
  floop = require("./common/floop"),
  messageAction = require("./common/message_action"),
  editorAction = require('./common/editor_action'),
  buffer = require("./common/buffer_model"),
  usersModel = require("./common/user_model"),
  prefs = require("./common/userPref_model"),
  perms = require("./common/permission_model"),
  atomRange = require('atom').Range,
  DMP = require("diff_match_patch"),
  Transport = require("./transport"),
  utils = require('./utils');


function FlooHandler(floourl, me, users, bufs, terminals, filetree) {
  this.get_buf_cb = {};
  this.paths_to_ids = {};
  this.floourl = floourl;
  this.editors = {};
  this.ignore_events = false;
  this.send_patch_for = {};

  this.bufs = bufs;
  this.terminals = terminals;
  this.filetree = filetree;
  this.users = users;
  this.me = me;
  this.atom_listener = new AtomListener(this.bufs, this.users);
}

FlooHandler.prototype.start = function () {
  var self = this, auth;

  this.bufs.start();

  atom.workspace.getTextEditors(function (editor) {
    self.editors[editor.buffer.getPath()] = editor;
  });

  auth = floorc.auth[this.floourl.host];

  floop.onROOM_INFO(this.on_room_info, this);
  floop.onJOIN(this.on_join, this);
  // floop.onDISCONNECT(this.on_disconnect, this);
  floop.onPART(this.on_part, this);
  floop.onSET_TEMP_DATA(this.on_set_temp_data, this);
  floop.onDELETE_TEMP_DATA(this.on_delete_temp_data, this);
  floop.onPERMS(this.on_perms, this);
  messageAction.success(`Connecting to ${fl.base_path}.`, true);
  floop.connect(new Transport(this.floourl.host, this.floourl.port), {
      'username': auth.username,
      'secret': auth.secret,
      "path": util.format("%s/%s", this.floourl.owner, this.floourl.workspace),
      'client': "Atom",
      'platform': process.platform,
      'supported_encodings': ["utf8", "base64"],
      'version': "0.11"
    }
  );
};

FlooHandler.prototype.stop = function () {
  var self = this;

  this.atom_listener.stop();
  this.atom_listener = null;
  this.bufs.stop();
  this.bufs = null;
  floop.disconnect();
  floop.off();
};

FlooHandler.prototype.permsChanged = function () {
  // var args = [];
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
  user = opt_user || new usersModel.User();
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
  var self = this;
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

FlooHandler.prototype.on_perms = function (data) {
  var user, permissions;

  user = this.users.getByConnectionID(data.user_id);
  if (!user) {
    console.log("user not found", data.user_id);
    return;
  }
  permissions = user.permissions.valueOf();
  switch (data.action) {
    case "add":
      permissions = _.uniq(permissions.concat(data.perms));
      break;
    case "remove":
      permissions = _.difference(permissions, data.perms);
      break;
    case "set":
      permissions = _.clone(data.perms);
      break;
    default:
      console.log("Unhandled permission type");
      break;
  }
  user.permissions.set(permissions);
  if (user.isMe) {
    perms.set(permissions.valueOf());
    this.permsChanged();
  }
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
  var that = this,
    open_editors = {},
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
    // this.terminals.addTerminal(termId, term.term_name, term.size[0], term.size[1], user.id);
  }, this);

  messageAction.success(`You have joined ${fl.base_path}.`, true);

  this.permsChanged();
  if (perms.indexOf("patch") === -1) {
    prefs.following = true;
    messageAction.info("Following changes because you don't have edit permission.");
  }

  this.atom_listener.start();

  this.temp_data = {};
  workspace.temp_data = workspace.temp_data || {};
  this.handle_temp_data(workspace.temp_data);
  this.temp_data = workspace.temp_data;

  console.log("starting syncing");

  let different = {};
  let newFiles = {};
  let found = {};
  let missing = {};

  async.auto({
    files: function (cb) {
      var files = [];
      var entries = [atom.project.getRootDirectory()];
      var entry;
      var repo = atom.project.getRepo();

      while (entries.length) {
        entry = entries.pop();
        if (repo && repo.isPathIgnored(entry.getRealPathSync())) {
          console.log("ignoring ", entry.getRealPathSync());
          continue;
        }
        if (entry.isFile()) {
          files.push(entry);
          continue;
        }
        if (!entry.isDirectory()) {
          continue;
        }
        entries = entries.concat.apply(entries, entry.getEntriesSync());
      }
      return cb(null, files);
    },
    editors: function (cb) {
      atom.workspace.getTextEditors(function (editor) {
        var md5, txt, fluffer = that.bufs.findFluffer(editor);
        if (!fluffer) {
          let p = editor.getPath();
          if (!p) {
            return;
          }
          if (utils.is_shared(fl.base_path, p)) {
            newFiles[path.relative(fl.base_path, p)] = {path: p, txt: editor.getText()};
          }
          return;
        }
        txt = editor.getText();
        md5 = utils.md5(txt);
        if (md5 === fluffer.md5) {
          fluffer.set({buf: txt, populated: true}, {silent: true});
          found[fluffer.id] = md5;
          return;
        }
        different[fluffer.id] = {path: fluffer.path, txt: txt, md5: md5};
      });
      cb(null);
    },
    iter_fs: ["files", "editors", function (cb, res) {
      async.eachLimit(res.files, 10, function(file, cb) {
        var fluffer = that.bufs.findFluffer(file);
        // the file doesn't match a buffer
        if (!fluffer) {
          let p = file.getPath();
          let rel = path.relative(fl.base_path, p);
          if (rel.indexOf("..") !== -1) {
            return cb();
          }
          newFiles[rel] = {path: p};
          return cb();
        }

        // open in editor
        if (fluffer.id in found) {
          return cb();
        }
        fs.readFile(file.path, function (err, buffer) {
          if (err) {
            console.error(err);
            missing[fluffer.id] = {path: file.path};
            return cb();
          }
          let encoding = utils.is_binary(buffer, buffer.length) ? "base64" : "utf8";
          let md5 = utils.md5(buffer);
          let txt = encoding === "utf8" ? buffer.toString() : buffer;
          if (md5 !== fluffer.md5 || encoding !== fluffer.encoding) {
            different[fluffer.id] = {path: fluffer.path, txt: txt, md5: md5, encoding: encoding};
          } else {
            // TODO: is inserting a buffer safe?
            fluffer.set({buf: txt, populated: true}, {silent: true});
            found[fluffer.id] = md5;
          }
          return cb();
        });
      }, cb);
    }],
    missing_bufs: ["iter_fs", function (cb) {
      that.bufs.forEach(function (buf) {
        var id = buf.id;
        if (id in different || id in found) {
          return cb();
        }
        missing[id] = buf.path;
        cb();
      });
      return cb(null, missing);
    }]
  }, function (err, res) {
    editorAction.handle_conflicts(newFiles, different, missing);
  });
};

FlooHandler.prototype.on_join = function (d) {
  var self = this;

  console.log(d.username + ' joined the room on ' + d.platform);
};

FlooHandler.prototype.on_part = function (d) {
  console.log(d.username + ' joined the room');
};

FlooHandler.prototype.on_disconnect = function (d) {
  console.error('You were disconnected because', d.reason);
};

exports.FlooHandler = FlooHandler;
