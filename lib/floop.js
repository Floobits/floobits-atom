var util = require("util"),
  tls = require("tls"),
  Floopt = require("./common/floop");

Floopt.prototype.send_ = function(name, msg, cb, context) {
  var str;

  if (!this.connected_) {
    return cb && cb("not connected");
  }

  msg.name = name;

  str = util.format("%s\n", JSON.stringify(msg));

  console.info("writing to conn:", str);
  try {
    this.conn.write(str, cb && cb.bind(context));
  } catch (e) {
    console.error("error writing to client:", e, "disconnecting");
  }
};

Floopt.prototype.disconnect_ = function(msg) {
  if (!this.conn) {
    return msg;
  }
  
  try{
    this.conn.end();
    this.conn.destroy();
  } catch (e) {}

  this.conn = null;
  return msg;
};

Floopt.prototype.data_handler_ = function (d) {
  var args, f, msg,
    newline_index;

  this.conn_buf += d;

  newline_index = this.conn_buf.indexOf("\n");
  while (newline_index !== -1) {
    msg = this.conn_buf.slice(0, newline_index);
    this.conn_buf = this.conn_buf.slice(newline_index + 1);
    newline_index = this.conn_buf.indexOf("\n");
    msg = JSON.parse(msg);
    if (!msg.name) {
      continue;
    }
    f = this[msg.name];
    if (!f) {
      console.error("no action for " + msg.name);
      continue;
    }
    f(msg);
  }
};

Floopt.prototype.handle_msg = function (msg) {
  var self = this;

  try {
    msg = JSON.parse(msg);
  } catch (e) {
    console.error("couldn't parse json:", msg, "error:", e);
    throw e;
  }
  console.info("calling", msg.name);
  self.emit("message", msg);
};

Floopt.prototype.connect_ = function (host, port, cb) {
  var self = this,
    options;

  this.connected_ = false;
  self.conn_buf = "";
  self.conn = tls.connect({
    host: host,
    port: port,
    // TODO: rejectUnauthorized! This is stupidly insecure
    rejectUnauthorized: false,
  }, function () {
    self.connected_ = true;
    cb();
  });
  self.conn.setEncoding('utf8');
  self.conn.on('end', function () {
    this.connected_ = false;
    console.warn('socket is gone');
    self.reconnect_();
  });
  self.conn.on('data', self.data_handler_.bind(self));
  self.conn.on('error', function (err) {
    console.error('Connection error:', err);
    this.connected_ = false;
    self.reconnect_();
  });
};

module.exports = new Floopt();