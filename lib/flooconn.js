var events = require("events"),
  fs = require("fs"),
  net = require("net"),
  path = require("path"),
  tls = require("tls"),
  util = require("util");

var _ = require("lodash");
var DMP = require("diff_match_patch");
var log = require("floorine");

var utils = require("./utils");


var CLIENT = "atom";
var __VERSION__ = "0.03";

var FlooConnection = function (_path, floorc, args) {
  var self = this;

  events.EventEmitter.call(self);

  self.host = args.H;
  self.port = args.p;
  self.username = floorc.username;
  self.secret = floorc.secret;
  self.workspace = args.w;
  self.owner = args.o;
  self.readonly = args['read-only'];
  self.create = !!args.share;

  self.conn_buf = "";
  self.users = {};
  self.perms = [];
  self.get_buf_cb = {};
  self.reconnect_timeout = null;
  self.reconnect_delay = 500;
  self.path = _path;

  self.hooker = new Hooks(_path);
  self.listener = new Listener(_path, self, self.hooker);
};

util.inherits(FlooConnection, events.EventEmitter);

FlooConnection.prototype.user_id_to_name = function (id) {
  var self = this,
    user = self.users[id];

  return (user ? user.username : id);
};

FlooConnection.prototype.buf_id_to_path = function (id) {
  var self = this,
    buf = self.listener.bufs[id];

  return (buf ? buf.path : '');
};

FlooConnection.prototype.connect = function () {
  var self = this;

  clearTimeout(self.reconnect_timeout);
  self.reconnect_timeout = null;

  self.conn_buf = "";

  self.conn = tls.connect(self.port, self.host, function () {
    self.send_auth();
  });
  self.conn.on('end', function () {
    log.warn('socket is gone');
    self.reconnect();
  });
  self.conn.on('data', self.data_handler.bind(self));
  self.conn.on('error', function (err) {
    log.error('Connection error:', err);
    self.reconnect();
  });
};

FlooConnection.prototype.reconnect = function () {
  var self = this;

  if (self.reconnect_timeout) {
    return;
  }
  self.users = {};
  self.perms = [];
  self.connected = false;
  self.reconnect_timeout = setTimeout(self.connect.bind(self), self.reconnect_delay);
  self.reconnect_delay = Math.min(10000, Math.floor(1.5 * self.reconnect_delay));
  log.log('reconnecting in ', self.reconnect_delay);
  try {
    self.conn.close();
  } catch (ignore) {
  }
};

FlooConnection.prototype.handle_msg = function (msg) {
  var self = this,
    f;

  try {
    msg = JSON.parse(msg);
  } catch (e) {
    log.error("couldn't parse json:", msg, "error:", e);
    throw e;
  }

  log.debug("calling", msg.name);
  f = self['on_' + msg.name];

  if (_.isFunction(f)) {
    return f.call(self, msg);
  }
};

FlooConnection.prototype.data_handler = function (d) {
  var self = this,
    msg,
    newline_index;

  // log.debug("d: |" + d + "|");

  self.conn_buf += d;

  newline_index = self.conn_buf.indexOf("\n");
  while (newline_index !== -1) {
    msg = self.conn_buf.slice(0, newline_index);
    self.conn_buf = self.conn_buf.slice(newline_index + 1);
    self.handle_msg(msg);
    newline_index = self.conn_buf.indexOf("\n");
  }
};

FlooConnection.prototype.write = function (name, json) {
  var self = this,
    str;

  if (!self.connected) {
    return;
  }

  json.name = name;
  str = JSON.stringify(json);
  log.debug("writing to conn:", str);
  try {
    self.conn.write(str + "\n");
  } catch (e) {
    log.error("error writing to client:", e, "disconnecting");
    process.exit(1);
  }
};

FlooConnection.prototype.send_auth = function () {
  var self = this,
    str;

  str = JSON.stringify({
    'username': self.username,
    'secret': self.secret,
    'room': self.workspace,
    'room_owner': self.owner,
    'client': CLIENT,
    'platform': process.platform,
    'supported_encodings': ['utf8', 'base64'],
    'version': __VERSION__
  }) + "\n";

  log.debug("writing to conn:", str);
  self.conn.write(str);
};

FlooConnection.prototype.send_get_buf = function (buf_id) {
  var self = this;
  self.write('get_buf', {id: buf_id});
  delete self.listener.bufs[buf_id].buf;
};

FlooConnection.prototype.send_create_buf = function (buf) {
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

FlooConnection.prototype.send_delete_buf = function (buf_id) {
  var self = this;

  if (self.readonly) {
    return;
  }

  self.write('delete_buf', {
    'id': buf_id
  });
};

FlooConnection.prototype.send_patch = function (buf, after) {
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

FlooConnection.prototype.on_room_info = function (d) {
  var self = this,
    bufs = self.listener.bufs,
    paths_to_ids = self.listener.paths_to_ids;

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

  _.each(d.bufs, function (buf, id) {
    var file, md5,
      _path = path.join(self.listener.path, buf.path);

    id = parseInt(id, 10);
    paths_to_ids[buf.path] = id;
    bufs[id] = buf;

    try {
      /*jslint stupid: true */
      file = fs.readFileSync(_path);
      /*jslint stupid: false */
    } catch (ignore) {
    }

    if (!file) {
      if (self.create) {
        return self.send_delete_buf(id);
      }
      return self.send_get_buf(id);
    }
    buf.buf = file;
    md5 = utils.md5(file);

    if (buf.md5 !== md5) {
      log.log("buf", buf.path, "md5 sum mismatch. re-fetching...", md5, buf.md5);
      self.send_get_buf(id);
      if (self.create) {
        self.get_buf_cb[id] = function (buf_id) {
          var our_buf = new Buffer(file);
          self.send_patch(self.listener.bufs[buf_id], our_buf);
          self.listener.bufs[buf_id].buf = our_buf;
        };
      } else {
        delete buf.buf;
      }
      return;
    }
  });
  if (self.create) {
    try {
      self.listener.create_buf(self.listener.path);
    } catch (e) {
      log.error(util.format("Error creating %s: %s", self.listener.path, e.toString()));
    }
  }
  log.log("all done syncing");

  self.emit('room_info');

  if (!self.readonly) {
    self.listener.watch_path(self.path);
  }
};

FlooConnection.prototype.on_get_buf = function (info) {
  var self = this,
    cb,
    buf = self.listener.bufs[info.id];

  buf.buf = new Buffer(info.buf, info.encoding);
  buf.md5 = info.md5;
  self.listener.bufs[buf.id] = buf;
  cb = self.get_buf_cb[buf.id];
  if (cb) {
    cb(buf.id);
    delete self.get_buf_cb[buf.id];
    return;
  }
  self.listener.write(buf);
};

FlooConnection.prototype.on_create_buf = function (buf) {
  var self = this,
    abs_path = path.join(self.listener.path, buf.path),
    dir = path.dirname(abs_path);

  self.listener.bufs[buf.id] = buf;
  self.listener.paths_to_ids[buf.path] = buf.id;
  self.listener.expected_changes = _.without(self.listener.expected_changes, abs_path);
  buf.buf = new Buffer(buf.buf, buf.encoding);

  // if we have the thing on disk, don't stomp it
  try {
    self.listener.on_change(abs_path, buf);
  } catch (e) {
    // we need to write an emtpy file before we can watch it
    self.listener.write(buf, function () {
      self.send_get_buf(buf.id);
      if (!self.readonly) {
        self.listener.watch_path(dir);
      }
    });
    return;
  }

  if (!self.readonly) {
    self.listener.watch_path(dir);
  }
};

FlooConnection.prototype.on_rename_buf = function (d) {
  var self = this,
    buf = self.listener.bufs[d.id],
    old_path = buf.path;

  buf.path = d.path;
  self.listener.rename(old_path, d.path);
};

FlooConnection.prototype.on_join = function (d) {
  var self = this;

  log.log(d.username + ' joined the room on ' + d.platform);
  self.users[d.user_id] = d;
};

FlooConnection.prototype.on_part = function (d) {
  log.log(d.username + ' joined the room');
};

FlooConnection.prototype.on_saved = function (d) {
  var self = this,
    username = self.user_id_to_name(d.user_id),
    _path = self.buf_id_to_path(d.id);

  log.log(_path + ' was saved by ' + username);

  self.hooker.on_saved(_path);
};

FlooConnection.prototype.on_patch = function (d) {
  var self = this;

  self.listener.patch(d.patch, d.md5_after, d.id);
};

FlooConnection.prototype.on_delete_buf = function (d) {
  var self = this;
  self.listener.delete_buf(d.path);
};

FlooConnection.prototype.on_error = function (d) {
  log.error(d);
};

FlooConnection.prototype.on_disconnect = function (d) {
  log.error('You were disconnected because', d.reason);
  process.exit(1);
};

FlooConnection.prototype.on_highlight = function (d) {
  log.debug("Highlight", d);
};

module.exports = FlooConnection;
