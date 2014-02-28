var _ = require("lodash"),
  path = require("path"),
  fs = require("fs"),
  async = require("async"),
  dmp = require("diff_match_patch"),
  util = require("util"),
  DMP = new dmp.diff_match_patch();

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
  self.floourl = floourl;

  self.base_path = base_path;
  self.floorc = floorc;
}

FlooHandler.prototype.listen = function() {
  var self = this;

  atom.workspace.eachEditor(function(editor) {
    var buffer = editor.buffer;
    
    if (editor.mini) {
      return;
    }
    var buffer_path = buffer.getPath();
    if (!buffer_path || !utils.is_shared(self.base_path, buffer_path)) {
      return;
    }
    buffer.on("changed", _.bind(self.atom_changed, self, editor));
    // buffer.on("destroyed", _.bind(self, "destroyed", editor));
    buffer.on("path-changed", _.bind(self.atom_renamed, self, editor));
  });
};

FlooHandler.prototype.start = function() {
  var self = this;

  self.conn = new flooconn.FlooConn(self.floourl.host, self.floourl.port);
  self.conn.on("connected", _.bind(self.on_connected, self));
  self.conn.on("room_info", _.bind(self.on_room_info, self));
  self.conn.on("get_buf", _.bind(self.on_get_buf, self));
  self.conn.on("create_buf", _.bind(self.on_create_buf, self));
  self.conn.on("rename_buf", _.bind(self.on_rename_buf, self));
  self.conn.on("join", _.bind(self.on_join, self));
  self.conn.on("part", _.bind(self.on_part, self));
  self.conn.on("saved", _.bind(self.on_saved, self));
  self.conn.on("patch", _.bind(self.on_patch, self));
  self.conn.on("delete_buf", _.bind(self.on_delete_buf, self));
  self.conn.on("error", _.bind(self.on_error, self));
  self.conn.on("disconnect", _.bind(self.on_disconnect, self));
  self.conn.on("highlight", _.bind(self.on_highlight, self));
  this.conn.connect();
};

FlooHandler.prototype.stop = function() {
  var self = this;

  if (self.conn) {
    self.conn.stop();
    self.conn = null;
  }
};

FlooHandler.prototype.atom_changed = function(editor, change) {
  var p,
    text,
    id,
    buf,
    patches,
    md5_before,
    patch_text,
    self = this,
    buffer_path = editor.buffer.getPath();
  
  p = path.relative(this.base_path, buffer_path);
  id = this.paths_to_ids[p];
  if (!id) {
    return;
  }
  buf = this.bufs[id];
  text = editor.getText();
  patches = DMP.patch_make(buf.buf.toString(), text);
  patch_text = DMP.patch_toText(patches);

  buf.buf = new Buffer(text);
  md5_before = buf.md5;
  buf.md5 = utils.md5(buf.buf);

  self.write("patch", {
    id: id,
    md5_after: buf.md5,
    md5_before: md5_before,
    path: buf.path,
    patch: patch_text
  });
};


FlooHandler.prototype.atom_renamed = function(editor) {
  debugger;
};


FlooHandler.prototype.write = function(name, json) {
  json.name = name;
  this.conn.write(json);

};

FlooHandler.prototype.on_connected = function() {
  var self = this;

  self.conn.write({
    'username': self.floorc.floorc.username,
    'secret': self.floorc.floorc.secret,
    'room': self.floourl.workspace,
    'room_owner': self.floourl.owner,
    'client': "Atom",
    'platform': process.platform,
    'supported_encodings': ['utf8', 'base64'],
    'version': "0.03"
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

  console.log("buf", buf.path, "doesn't exist. creating...");

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

  // switch (buf.encoding) {
  // case 'utf8':
  //   patches = JS_DMP.patch_make(buf.buf.toString(), after.toString());
  //   patch_text = JS_DMP.patch_toText(patches);
  //   break;
  // case "base64":
  //   if (!DMP) {
  //     return console.warn(util.format("Can't make patch for %s: No native-diff-match-patch module.", buf.path));
  //   }
  //   patch_text = DMP.patch_make(buf.buf, after);
  //   break;
  // default:
  //   return console.warn(util.format("Can't make patch for %s: Unknown encoding %s.", buf.path, buf.encoding));
  // }

  // md5_after = utils.md5(after);

  // self.write('patch', {
  //   'id': buf.id,
  //   'md5_after': md5_after,
  //   'md5_before': buf.md5,
  //   'path': buf.path,
  //   'patch': patch_text
  // });

  // buf.buf = after;
  // buf.md5 = md5_after;
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
      console.log("Setting readonly becuase we can't patch.");
    }
    self.readonly = true;
  }
  console.log("starting syncing");

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
        console.log(util.format("%s is different: %s %s", _path, buf.md5, md5));
        conflicting.push(id);
      }
      return cb();
    }

    fs.readFile(_path, function(err, buffer) {
      if (err) {
        missing.push(id);
        return cb();
      }
      buf.buf = buffer;
      md5 = utils.md5(buffer);
      if (buf.md5 !== md5) {
        console.log(util.format("%s is different: %s %s", _path, buf.md5, md5));
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
  var editors = atom.workspace.getEditors();
  var editor;
  for (var i=0; i < editors.length; i++) {
    editor = editors[i];
  }
  // self.listener.write(buf);
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

  console.log(d.username + ' joined the room on ' + d.platform);
  self.users[d.user_id] = d;
};

FlooHandler.prototype.on_part = function (d) {
  console.log(d.username + ' joined the room');
};

FlooHandler.prototype.on_saved = function (d) {
  var self = this,
    username = self.user_id_to_name(d.user_id),
    _path = self.buf_id_to_path(d.id);

  console.log(_path + ' was saved by ' + username);

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
  console.info("Highlight", d);
};

exports.FlooHandler = FlooHandler;
