var fs = require("fs"),
  _ = require('lodash'),
  util = require("util"),
  utils = require("./utils");

var IGNORE_FILES = [".gitignore", ".hgignore", ".flignore", ".flooignore"],
  WHITE_LIST = _.union(IGNORE_FILES, [".floo", ".idea"]),
  DEFAULT_IGNORES = ["extern", "node_modules", "tmp", "vendor", ".idea/workspace.xml", ".idea/misc.xml", ".git"],
  MAX_FILE_SIZE = 1024 * 1024 * 5;

var IgnoreRule = function(rule) {
  this.rule = rule;
};

var IgnoreNode = function() {

};

var Ignore = function(_path, parent, depth) {
  this.depth = 0;
  this.parent = parent;
  this.children = {};
  this.files = [];
  this.size = 0;
  this.ignoreNode = new IgnoreNode();
  this.path = _path;
};

Ignore.prototype.findIgnores = function(cb) {
  var self = this;

  fs.readDir(this.path, function(err, res) {
    if (err) {
      console.error(err);
      cb();
      return;
    }
    async.each(res, function(name, cb){
      var abs = path.join(self.path, name);

      if (IGNORE_FILES.indexOf(name) < 0) {
          cb();
          return;
      }

      fs.readFile(abs, {"encoding": "utf8"}, function(err, res) {
        self.ignoreNode.parse(res);
        cb();
      });
    }, cb);

    if (self.depth === 0) {
      this.ignoreNode.addRule(new IgnoreRule(".idea/workspace.xml"));
      this.ignoreNode.addRule(new IgnoreRule(".idea/misc.xml"));
      this.ignoreNode.addRule(new IgnoreRule(".git"));
    }
  });
};

Ignore.prototype.is_ignored = function() {
  return true;
};

exports.Ignore = Ignore;
