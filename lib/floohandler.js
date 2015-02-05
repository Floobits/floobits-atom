var _ = require("lodash"),
  path = require("path"),
  fs = require("fs-extra"),
  async = require("async"),
  dmp = require("./floodmp"),
  util = require("util"),
  Range = require('atom').Range,
  DMP = new dmp.FlooDMP();

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
  self.editors = {};
  self.base_path = base_path;
  self.floorc = floorc;
  self.ignore_events = false;
}

FlooHandler.prototype.start = function () {
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
  atom.workspace.eachEditor(function (editor) {
    var buffer = editor.buffer;

    if (!self.conn) return;

    if (editor.mini) {
      return;
    }
    var buffer_path = buffer.getPath();
    if (!buffer_path || !utils.is_shared(self.base_path, buffer_path)) {
      return;
    }
    self.editors[buffer_path] = editor;
    editor.on('cursor-moved', _.bind(self.atom_selected, self, editor));
    buffer.on("markers-updated", _.bind(self.atom_selected, self, editor));
    buffer.on("changed", _.bind(self.atom_changed, self, editor));
    // buffer.on("destroyed", _.bind(self.atom_destroyed, self, editor));
    buffer.on("path-changed", _.bind(self.atom_renamed, self, editor));
    buffer.on("saved", _.bind(self.atom_saved, self, editor));
    if (!buffer.file) {
      return;
    }
    buffer.file.on("destroyed removed", _.bind(self.atom_destroyed, self, editor));
    // buffer.file.on("path-changed removed moved")
  });
  this.conn.connect();
};

FlooHandler.prototype.stop = function () {
  var self = this;

  if (self.conn) {
    self.conn.stop();
    self.conn = null;
  }
};

FlooHandler.prototype.atom_saved = function (editor) {
  var self = this,
    p = editor.getPath(),
    buf = self.get_buf_by_path(p);

  if (!buf || !buf.buf || self.ignore_events) {
    return;
  }

  self.write("saved", {id: buf.id});

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

  self.write('highlight', {
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
  debugger;
};

FlooHandler.prototype.atom_changed = function (editor, change) {
  var p,
    text,
    id,
    buf,
    patches,
    md5_before,
    patch_text,
    self = this,
    buffer_path = editor.buffer.getPath();

  if (!self.conn) return;
  if (self.ignore_events) return;

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
  if (md5_before === buf.md5){
    return;
  }

  self.write("patch", {
    id: id,
    md5_after: buf.md5,
    md5_before: md5_before,
    path: buf.path,
    patch: patch_text
  });
};


FlooHandler.prototype.atom_renamed = function (editor) {
  debugger;
};


FlooHandler.prototype.write = function (name, json) {
  json.name = name;
  this.conn.write(json);

};

FlooHandler.prototype.on_connected = function () {
  var self = this,
    auth = this.floorc.auth[this.floourl.host];

  self.conn.write({
    'username': auth.username,
    'secret': auth.secret,
    'room': self.floourl.workspace,
    'room_owner': self.floourl.owner,
    'client': "Atom",
    'platform': process.platform,
    'supported_encodings': ["utf8", "base64"],
    'version': "0.11"
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

  async.eachLimit(_.keys(d.bufs), 10, function (id, cb) {
    var file, md5, editor,
      buf = d.bufs[id],
      _path = path.join(self.base_path, buf.path);

    id = parseInt(id, 10);
    self.paths_to_ids[buf.path] = id;
    self.bufs[id] = buf;

    editor = self.editors[_path];
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

    fs.readFile(_path, function (err, buffer) {
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
  }, function (err) {
    _.each(missing, function (id) {
      self.send_get_buf(id);
    });
    _.each(conflicting, function (id) {
      self.send_get_buf(id);
    });
  });
};

FlooHandler.prototype.get_buf_by_path = function (_path) {
  var p = path.relative(this.base_path, _path),
    id = this.paths_to_ids[p];

  return this.bufs[id];
};

FlooHandler.prototype.on_get_buf = function (info) {
  var self = this,
    cb, editor,
    buf = self.bufs[info.id],
    abs_path = path.join(this.base_path, buf.path);

  buf.buf = new Buffer(info.buf, info.encoding);
  buf.md5 = info.md5;
  self.bufs[buf.id] = buf;
  cb = self.get_buf_cb[buf.id];
  if (cb) {
    cb(buf.id);
    delete self.get_buf_cb[buf.id];
    return;
  }
  editor = this.editors[abs_path];
  if (!editor) {
    fs.outputFileSync(abs_path, buf.buf);
    return;
  }
  self.ignore_events = true;
  editor.setText(buf.buf.toString());
  self.ignore_events = false;
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

  if (editor){
    self.ignore_events = true;
    editor.buffer.save();
    self.ignore_events = false;
  }

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
      r = new Range(start_pos, end_pos);
    console.log("replacing", start_pos, end_pos, replace);
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
