var _ = require("underscore");

var flooconn = require("./flooconn"),
  utils = require('./utils');

function FlooHandler(floourl, floorc, base_path) {
  var self = this;

  self.users = {};
  self.perms = [];
  self.get_buf_cb = {};
  self.bufs = {};
  self.paths_to_ids = {};
  self.conn = null;
  self.base_path = base_path;
}

FlooHandler.prototype.start = function() {
  var self = this;

  self.conn = new flooconn.FlooConn();
  self.conn.on("connected", _.bind(self, self.on_connected));
  self.conn.on("room_info", _.bind(self, self.on_room_info));
  self.conn.on("get_buf", _.bind(self, self.on_get_buf));
  self.conn.on("create_buf", _.bind(self, self.on_create_buf));
  self.conn.on("rename_buf", _.bind(self, self.on_rename_buf));
  self.conn.on("join", _.bind(self, self.on_join));
  self.conn.on("part", _.bind(self, self.on_part));
  self.conn.on("saved", _.bind(self, self.on_saved));
  self.conn.on("patch", _.bind(self, self.on_patch));
  self.conn.on("delete_buf", _.bind(self, self.on_delete_buf));
  self.conn.on("error", _.bind(self, self.on_error));
  self.conn.on("disconnect", _.bind(self, self.on_disconnect));
  self.conn.on("highlight", _.bind(self, self.on_highlight));
  this.conn.connect();
};

FlooHandler.prototype.on_connected = function() {
  self.conn.write(null, {
    'username': self.floorc.username,
    'secret': self.floorc.secret,
    'room': self.floourl.workspace,
    'room_owner': self.floourl.owner,
    'client': CLIENT,
    'platform': process.platform,
    'supported_encodings': ['utf8', 'base64'],
    'version': __VERSION__
  });
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
  self.write('get_buf', {id: buf_id});
  delete self.bufs[buf_id].buf;
};

FlooHandler.prototype.send_create_buf = function (buf) {
  var self = this;

  if (self.readonly) {
    return;
  }

  log.log("buf", buf.path, "doesn't exist. creating...");

  self.write('create_buf', {
    buf: buf.buf.toString(buf.encoding),
    encoding: buf.encoding,
    md5: buf.md5,
    path: buf.path
  });
};

FlooHandler.prototype.send_delete_buf = function (buf_id) {
  var self = this;

  if (self.readonly) {
    return;
  }

  self.write('delete_buf', {
    'id': buf_id
  });
};

FlooHandler.prototype.send_patch = function (buf, after) {
  var self = this,
    patches,
    patch_text,
    md5_after;

  if (self.readonly) {
    return;
  }

  switch (buf.encoding) {
  case 'utf8':
    patches = JS_DMP.patch_make(buf.buf.toString(), after.toString());
    patch_text = JS_DMP.patch_toText(patches);
    break;
  case "base64":
    if (!DMP) {
      return log.warn(util.format("Can't make patch for %s: No native-diff-match-patch module.", buf.path));
    }
    patch_text = DMP.patch_make(buf.buf, after);
    break;
  default:
    return log.warn(util.format("Can't make patch for %s: Unknown encoding %s.", buf.path, buf.encoding));
  }

  md5_after = utils.md5(after);

  self.write('patch', {
    'id': buf.id,
    'md5_after': md5_after,
    'md5_before': buf.md5,
    'path': buf.path,
    'patch': patch_text
  });

  buf.buf = after;
  buf.md5 = md5_after;
};

FlooHandler.prototype.on_room_info = function (d) {
  var self = this,
    open_editors = {},
    missing = [],
    conflicting = [];

  self.bufs = d.bufs;
  self.users = d.users;
  self.perms = d.perms;

  if (!_.contains(self.perms, "patch")) {
    if (!self.readonly) {
      log.log("Setting readonly becuase we can't patch.");
    }
    self.readonly = true;
  }

  self.connected = true;
  self.reconnect_timeout = null;
  self.reconnect_delay = 500;

  log.log("starting syncing");

  atom.workspaceView.eachEditorView(function(editorView) {
    var editor = editorView.getEditor(),
      path = editor.getPath();

    if (!editor.mini) open_editors[path] = editor;
  });
  
  async.eachLimit(_.keys(d.bufs), 10, function (id, cb) {
    var file, md5, editor,
      buf = d.bufs[id],
      _path = path.join(self.base_path, buf.path);

    id = parseInt(id, 10);
    self.paths_to_ids[buf.path] = id;
    self.bufs[id] = buf;

    editor = open_editors[_path];
    if (editor) {
      file = editor.getText();
      md5 = utils.md5(file);
      buf.buf = new Buffer(file);
      if (buf.md5 !== md5) {
        conflicting.push(id);
      }
      return cb();
    }

    fs.readFile(_path, function(err, buf) {
      var data;
      if (err) {
        missing.push(id);
        return cb();
      }

      if (buf.encoding == "utf8") {
        data = buf.toString();
      } else {
        data = buf;
      }
      buf.buf = data;
      md5 = utils.md5(data);
      if (buf.md5 !== md5) {
        conflicting.push(id);
      }
      return cb();
    });
  }, function(err) {
    _.each(missing, function(id) {
      self.send_get_buf(id);
    });
    _.each(conflicting, function(id) {
      self.send_get_buf(id);
    });
  });
};

FlooHandler.prototype.on_get_buf = function (info) {
  var self = this,
    cb,
    buf = self.bufs[info.id];

  buf.buf = new Buffer(info.buf, info.encoding);
  buf.md5 = info.md5;
  self.bufs[buf.id] = buf;
  cb = self.get_buf_cb[buf.id];
  if (cb) {
    cb(buf.id);
    delete self.get_buf_cb[buf.id];
    return;
  }
  // self.listener.write(buf);
};

FlooHandler.prototype.on_create_buf = function (buf) {
  var self = this,
    abs_path = path.join(self.listener.path, buf.path),
    dir = path.dirname(abs_path);

  self.bufs[buf.id] = buf;
  self.paths_to_ids[buf.path] = buf.id;
  // self.listener.expected_changes = _.without(self.listener.expected_changes, abs_path);
  buf.buf = new Buffer(buf.buf, buf.encoding);

  // // if we have the thing on disk, don't stomp it
  // try {
  //   self.listener.on_change(abs_path, buf);
  // } catch (e) {
  //   // we need to write an emtpy file before we can watch it
  //   self.listener.write(buf, function () {
  //     self.send_get_buf(buf.id);
  //     if (!self.readonly) {
  //       self.listener.watch_path(dir);
  //     }
  //   });
  //   return;
  // }

  // if (!self.readonly) {
  //   self.listener.watch_path(dir);
  // }
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

  log.log(d.username + ' joined the room on ' + d.platform);
  self.users[d.user_id] = d;
};

FlooHandler.prototype.on_part = function (d) {
  log.log(d.username + ' joined the room');
};

FlooHandler.prototype.on_saved = function (d) {
  var self = this,
    username = self.user_id_to_name(d.user_id),
    _path = self.buf_id_to_path(d.id);

  log.log(_path + ' was saved by ' + username);

  self.hooker.on_saved(_path);
};

FlooHandler.prototype.on_patch = function (d) {
  var self = this;

  // self.listener.patch(d.patch, d.md5_after, d.id);
};

FlooHandler.prototype.on_delete_buf = function (d) {
  var self = this;
  // self.listener.delete_buf(d.path);
};

FlooHandler.prototype.on_error = function (d) {
  log.error(d);
};

FlooHandler.prototype.on_disconnect = function (d) {
  log.error('You were disconnected because', d.reason);
  process.exit(1);
};

FlooHandler.prototype.on_highlight = function (d) {
  log.debug("Highlight", d);
};

