/*global fl */
"use strict";
"use babel";

const _ = require("lodash");
const fs = require("fs");
const async = require("async");
const util = require("util");
const flux = require("flukes");
const path = require("path");
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

const Transport = require("../../transport");
const utils = require("../utils");


function FlooHandler(floobits_base_path, floourl, me, users, bufs, filetree, createdWorkspace) {
  this.get_buf_cb = {};
  this.paths_to_ids = {};
  this.floourl = floourl;
  this.ignore_events = false;
  this.send_patch_for = {};
  this.createdWorkspace = createdWorkspace;

  // atom.Directory
  this.directory = utils.findDirectory(floobits_base_path);
  if (!this.directory) {
    throw new Error("Could not find the top level directory open in Atom", floobits_base_path);
  }
  this.bufs = bufs;
  this.filetree = filetree;
  this.users = users;
  this.me = me;
}

FlooHandler.prototype.start = function (auth) {
  const that = this;

  floop.onJOIN(this.on_join, this);
  floop.onPART(this.on_part, this);
  floop.onSET_TEMP_DATA(this.on_set_temp_data, this);
  floop.onDELETE_TEMP_DATA(this.on_delete_temp_data, this);
  floop.onPERMS(this.on_perms, this);
  floop.onMSG(this.on_msg, this);
  floop.onERROR(this.on_error, this);
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
  mugshot.stop();

  this.bufs = null;
  this.terminals = null;
  this.filetree = null;
  this.users = null;
  this.me = null;
  floop.off();
  floop.disconnect();
};

FlooHandler.prototype.on_error = function(data) {
  messageAction.error(data.msg, data.flash);
};

FlooHandler.prototype.on_msg = function(msg) {
  if (msg.from) {
    messageAction.private(msg.from, msg.data, msg.time);
    return;
  }
  messageAction.user(msg.username, msg.data, msg.time);
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
    color_: connection.color,
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
  _.each(data.data, (k) => {
    delete this.temp_data[k];
  });
};

FlooHandler.prototype.get_paths_to_upload = function (d, cb) {
  const toUpload = [];
  const entries = [d];
  const ignored = [];
  const tooBig = {};
  let entry;
  let totalSize = 0; // eslint-disable-line no-unused-vars
  while (entries.length) {
    entry = entries.pop();
    /* eslint-disable no-sync */
    const p = entry.getRealPathSync();
    /* eslint-enable no-sync */
    // TODO: skip ignored if root entry
    if (ignore.is_ignored(p)) {
      messageAction.info(`Skipping ${p} because it is ignored`);
      console.log("ignoring", p);
      ignored.push(p);
      continue;
    }
    if (entry.isFile()) {
      const size = ignore.getSize(p);
      if (ignore.is_too_big(size)) {
        tooBig[p] = size;
        messageAction.info(`Skipping ${p} because it is too big`);
        console.log("too big", p);
        continue;
      }
      totalSize += size;
      // TODO: store totalSize and check it against max workspace size
      toUpload.push(entry);
      continue;
    }
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.getPath().split(path.sep).length > 25) {
      console.warn("Went too deep (25 directory entries). Skipping directory", entry.getPath());
      console.warn("Maybe there's a symlink loop?");
      continue;
    }
    // TODO: this is super slow
    /*eslint-disable no-sync */
    const newEntries = entry.getEntriesSync();
    /*eslint-enable no-sync */
    for (let i = 0; i < newEntries.length; i++) {
      const newEntry = newEntries[i];
      if (newEntry.isFile()) {
        ignore.add_ignore(newEntry);
      }
      /* eslint-disable no-sync */
      // console.log("new", e.getRealPathSync());
      /* eslint-enable no-sync */
      entries.push(newEntry);
    }
  }
  return cb(null, {
    toUpload,
    ignored,
    tooBig,
  });
};

FlooHandler.prototype.on_room_info = function (workspace) {
  const that = this;
  const usersMap = {};

  usersMap[workspace.users[workspace.user_id].username] = this.me;
  this.me.myConnectionID = workspace.user_id;
  fl.username = workspace.users[workspace.user_id].username;
  console.log("room info", workspace);
  console.log("my user id", workspace.user_id);
  perms.set(workspace.perms, {silent: true});
  // TODO: very inefficient. causes a re-render of most of the UI next tick
  setTimeout(perms.update.bind(perms), 0);

  _.each(workspace.users, (connection) => {
    usersMap[connection.username] = this.upsertUser(connection, usersMap[connection.username], workspace.user_id).user;
  });

  this.users.set(_.values(usersMap));
  this.filetree.tree = workspace.tree;

  messageAction.success(`You have joined ${this.floourl.toString()}.`, true);

  this.permsChanged();
  if (perms.indexOf("patch") === -1) {
    prefs.following = true;
    messageAction.info("Following changes because you don't have edit permission.");
  }

  this.temp_data = {};
  workspace.temp_data = workspace.temp_data || {};
  this.handle_temp_data(workspace.temp_data);
  this.temp_data = workspace.temp_data;

  console.log("starting syncing");

  const different = {};
  const newFiles = {};
  const found = {};
  const missing = {};
  const createdWorkspace = this.createdWorkspace;

  async.auto({
    ignore: function (cb) {
      ignore.init(that.directory, cb);
    },
    paths: ["ignore", function (cb) {
      that.get_paths_to_upload(that.directory, cb);
    }],
    editors: ["paths", function (cb) {
      const editors = atom.workspace.getTextEditors();
      _.each(editors, function (editor) {
        var md5, txt, fluffer = that.bufs.findFluffer(editor);
        if (!fluffer) {
          let p = editor.getPath();
          if (p && utils.is_shared(p) && !ignore.is_ignored(p)) {
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
        fluffer.set({buf: txt, populated: false}, {silent: true});
      });
      cb(null);
    }],
    iter_fs: ["paths", function (iter_fs_cb, res) {
      async.eachLimit(res.paths.toUpload, 10, function (file, cb) {
        var fluffer = that.bufs.findFluffer(file);
        // the file doesn't match a buffer
        if (!fluffer) {
          /* eslint-disable no-sync */
          const p = file.getRealPathSync();
          /* eslint-enable no-sync */
          if (!utils.is_shared(p)) {
            setImmediate(cb);
            return;
          }
          newFiles[utils.to_rel_path(p)] = {path: p};
          setImmediate(cb);
          return;
        }

        // open in editor
        if (fluffer.id in found) {
          // TODO: md5 open buffer
          setImmediate(cb);
          return;
        }
        /* eslint-disable no-sync */
        fs.readFile(file.getRealPathSync(), function (err, buffer) {
          if (err) {
            console.error(err);
            missing[fluffer.id] = {path: file.getRealPathSync()};
            return cb();
          }
          let encoding = utils.is_binary(buffer, buffer.length) ? "base64" : "utf8";
          let md5 = utils.md5(buffer);
          let txt = encoding === "utf8" ? buffer.toString() : buffer;
          if (md5 !== fluffer.md5 || encoding !== fluffer.encoding) {
            different[fluffer.id] = {path: fluffer.path, txt: txt, md5: md5, encoding: encoding};
            fluffer.set({buf: txt, populated: false}, {silent: true});
          } else {
            // TODO: is inserting a buffer safe?
            fluffer.set({buf: txt, populated: true}, {silent: true});
            found[fluffer.id] = md5;
          }
          return cb();
        });
        /* eslint-enable no-sync */
      }, iter_fs_cb);
    }],
    missing_bufs: ["iter_fs", function (cb) {
      that.bufs.forEach(function (buf) {
        const id = buf.id;
        if (id in different || id in found) {
          return;
        }
        missing[id] = {path: buf.path};
      });
      return cb(null, missing);
    }]
  }, function (err, res) {
    if (err) {
      // TODO: actually handle these errors and bail
      console.error(err);
      messageAction.error(`Error in on_room_info: ${err}`, false);
    }
    let ignored = res.paths && res.paths.ignored;
    ignored = _.map(ignored, p => utils.is_shared(p) ? utils.to_rel_path(p) : p);
    let tooBig = {};
    if (res.paths && res.paths.tooBig) {
      _.each(res.paths.tooBig, (size, p) => {
        tooBig[utils.to_rel_path(p)] = size;
      });
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
  if (user.connections.length < 1) {
    this.users.remove(user.id);
  }
  // TODO: kans
  // editorAction.remove_highlight(connId);
};

exports.FlooHandler = FlooHandler;
