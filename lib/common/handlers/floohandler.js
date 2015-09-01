/*global fl */
"use strict";
"use babel";

const _ = require("lodash");
const fs = require("fs");
const async = require("async");
const util = require("util");
const flux = require("flukes");
const floop = require("../floop");
const messageAction = require("../message_action");
const editorAction = require("../editor_action");

const mugshot = require("../mugshot");
const usersModel = require("../user_model");
const prefs = require("../userPref_model");
const webrtcAction = require("../webrtc_action");
const perms = require("../permission_model");
const constants = require("../constants");
const ignore = require("../ignore");

const AtomListener = require("../../atom_listener");
const Transport = require("../../transport");
const utils = require("../../utils");


function FlooHandler(floobits_base_path, floourl, me, users, bufs, terminals, filetree, createdWorkspace) {
  this.get_buf_cb = {};
  this.paths_to_ids = {};
  this.floourl = floourl;
  this.ignore_events = false;
  this.send_patch_for = {};
  this.createdWorkspace = createdWorkspace;

  // atom.Directory
  this.directory = utils.findDirectory(floobits_base_path);
  this.bufs = bufs;
  this.terminals = terminals;
  this.filetree = filetree;
  this.users = users;
  this.me = me;
  this.atom_listener = new AtomListener(this.bufs, this.users);
  editorAction.set(bufs, terminals, prefs);
}

FlooHandler.prototype.start = function (auth) {
  var that = this;

  this.bufs.start();

  floop.onROOM_INFO(this.on_room_info, this);
  floop.onJOIN(this.on_join, this);
  floop.onPART(this.on_part, this);
  floop.onSET_TEMP_DATA(this.on_set_temp_data, this);
  floop.onDELETE_TEMP_DATA(this.on_delete_temp_data, this);
  floop.onPERMS(this.on_perms, this);
  messageAction.success(`Connecting to ${this.floourl.toString()}.`, true);

  function mugHandler () {
    mugshot.stop();
    if (perms.indexOf("datamsg") < 0) {
      return;
    }
    if (prefs.mugshots && !prefs.dnd) {
      mugshot.start(that.users, that.me.getMyConnection());
    } else {
      that.users.broadcast_data_message_for_perm({name: "user_image", image: null}, "get_buf");
    }
  }

  this.permsID = perms.on(mugHandler);
  this.prefsDND = prefs.on("dnd", mugHandler);
  this.prefsMugshots = prefs.on("mugshots", mugHandler);

  floop.connect(new Transport(this.floourl.host, this.floourl.port), {
    api_key: auth.api_key,
    username: auth.username,
    secret: auth.secret,
    path: util.format("%s/%s", this.floourl.owner, this.floourl.workspace),
    client: "Atom",
    platform: process.platform,
    supported_encodings: ["utf8", "base64"],
    version: constants.VERSION
  });
};

FlooHandler.prototype.stop = function () {
  perms.off(this.permsID);
  prefs.off(this.prefsMugshots);
  prefs.off(this.prefsDND);
  editorAction.off();
  this.atom_listener.stop();
  this.bufs.stop();
  mugshot.stop();

  this.bufs = null;
  this.terminals = null;
  this.filetree = null;
  this.users = null;
  this.me = null;
  this.atom_listener = null;
  webrtcAction.off();
  floop.off();
  floop.disconnect();
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
  var conn, user, username, isMe = connection.user_id === opt_myUserId;
  username = connection.username;
  user = opt_user || new usersModel.User();
  conn = user.createConnection(connection.user_id, connection.client, connection.platform, connection.version, isMe);
  user.set({
    isMe: isMe,
    can_contract: connection.can_contract,
    rate: connection.rate,
    id: username,
    permissions: new flux.List(connection.perms),
    isAnon: connection.is_anon,
    gravatar: connection.gravatar,
  });
  return {
    conn: conn,
    user: user,
  };
};

FlooHandler.prototype.handle_temp_data = function (data) {
  const that = this;
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
        that.location.href = data.hangout.url;
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
  const that = this, usersMap = {};

  editorAction.onKICK(this.kick.bind(this));
  usersMap[workspace.users[workspace.user_id].username] = this.me;
  this.me.myConnectionID = workspace.user_id;
  fl.username = workspace.users[workspace.user_id].username;
  console.log("room info", workspace);
  console.log("my user id", workspace.user_id);
  perms.set(workspace.perms, {silent: true});
  // TODO: very inefficient. causes a re-render of most of the UI next tick
  setTimeout(perms.update.bind(perms), 0);

  _.each(workspace.users, function (connection) {
    usersMap[connection.username] = this.upsertUser(connection, usersMap[connection.username], workspace.user_id).user;
  }, this);

  this.users.set(_.values(usersMap));
  this.filetree.tree = workspace.tree;

  _.each(workspace.bufs, function (buf) {
    this.bufs.add(buf);
  }, this);

  _.each(workspace.terms, function (term, termId) {
    var user = this.users.getByConnectionID(term.owner);
    this.terminals.addTerminal(termId, term.term_name, term.size[0], term.size[1], user.id);
  }, this);
  messageAction.success(`You have joined ${this.floourl.toString()}.`, true);

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

  const different = {};
  const newFiles = {};
  const found = {};
  const missing = {};
  const ignored = [];
  const tooBig = {};
  const createdWorkspace = this.createdWorkspace;

  async.auto({
    ignore: function (cb) {
      ignore.init(that.directory, cb);
    },
    files: ["ignore", function (cb) {
      const files = [];
      const entries = [that.directory];
      let entry;
      let totalSize = 0;
      while (entries.length) {
        entry = entries.pop();
        const p = entry.getPath();
        if (ignore.is_ignored(p)) {
          console.log("ignoring", p);
          ignored.push(p);
          continue;
        }
        if (entry.isFile()) {
          const size = ignore.getSize(p);
          if (ignore.is_too_big(size)) {
            tooBig[p] = size;
            console.log("too big", p);
            continue;
          }
          totalSize += size;
          ignore.add_ignore(entry);
          files.push(entry);
          continue;
        }
        if (!entry.isDirectory()) {
          continue;
        }
        // TODO: this is super slow
        /*eslint-disable no-sync */
        const newEntries = entry.getEntriesSync();
        /*eslint-enable no-sync */
        for (let i = 0; i < newEntries.length; i++) {
          const e = newEntries[i];
          console.log("new", e.getPath());
          entries.push(e);
        }
      }
      return cb(null, files);
    }],
    editors: function (cb) {
      const editors = atom.workspace.getTextEditors();
      _.each(editors, function (editor) {
        var md5, txt, fluffer = that.bufs.findFluffer(editor);
        if (!fluffer) {
          let p = editor.getPath();
          if (utils.is_shared(p)) {
            newFiles[utils.to_rel_path(p)] = {path: p, txt: editor.getText()};
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
    iter_fs: ["files", "editors", function (iter_fs_cb, res) {
      async.eachLimit(res.files, 10, function (file, cb) {
        var fluffer = that.bufs.findFluffer(file);
        // the file doesn't match a buffer
        if (!fluffer) {
          const p = file.getPath();
          if (!utils.is_shared(p)) {
            return cb();
          }
          newFiles[utils.to_rel_path(p)] = {path: p};
          return cb();
        }

        // open in editor
        if (fluffer.id in found) {
          return cb();
        }
        fs.readFile(file.getPath(), function (err, buffer) {
          if (err) {
            console.error(err);
            missing[fluffer.id] = {path: file.getPath()};
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
      }, iter_fs_cb);
    }],
    missing_bufs: ["iter_fs", function (cb) {
      that.bufs.forEach(function (buf) {
        var id = buf.id;
        if (id in different || id in found) {
          return cb();
        }
        missing[id] = {path: buf.path};
        cb();
      });
      return cb(null, missing);
    }]
  }, function (err) {
    if (err) {
      // TODO: actually handle these errors and bail
      console.error(err);
    }
    console.log("local info:", that.floourl.toString(), _.size(newFiles), _.size(different), _.size(missing), _.size(ignored), _.size(tooBig), createdWorkspace);
    editorAction.handle_conflicts(newFiles, different, missing, ignored, tooBig, createdWorkspace);
  });
};

FlooHandler.prototype.on_join = function (connInfo) {
  const foundUser = this.users.get(connInfo.username);
  const result = this.upsertUser(connInfo, foundUser);
  const user = result.user;
  const conn = result.conn;

  messageAction.log(`${connInfo.username} joined using ${connInfo.client} on ${connInfo.platform}`, null, true);

  if (!foundUser) {
    this.users.add(user);
  }

  console.log(connInfo.username + " joined the room on " + connInfo.platform);

  const image = this.me.getMyConnection().image;
  if (!image || !conn.isWeb()) {
    return;
  }
  floop.emitDataMessage({
    name: "user_image",
    image: image,
  }, [connInfo.user_id]);
};

FlooHandler.prototype.on_part = function (partData) {
  const connId = partData.user_id;
  const username = partData.username;
  const user = this.users.get(username);
  if (!user) {
    console.log("part: Unknown user parted.", username);
    return;
  }
  const connInfo = user.connections.get(connId);
  messageAction.log(`${username} left. (Using ${connInfo.client} on ${connInfo.platform})`, null, true);
  webrtcAction.stop_video_chat(connId);
  user.connections.remove(connId);
  if (user.connections.length < 1 ) {
    this.users.remove(user.id);
  }
  // TODO: kans
  // editorAction.remove_highlight(connId);
};

FlooHandler.prototype.kick = function (connectionIDorUsername) {
  let msg;
  if (_.isNumber(connectionIDorUsername)) {
    msg = {user_id: connectionIDorUsername};
  } else {
    msg = {username: connectionIDorUsername};
  }
  floop.send_kick(msg);
};

exports.FlooHandler = FlooHandler;
