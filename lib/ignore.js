var fs = require("fs"),
  _ = require('lodash'),
  util = require("util"),
  minimatch = require("minimatch"),
  utils = require("./utils");

var IGNORE_FILES = [".gitignore", ".hgignore", ".flignore", ".flooignore"],
  WHITE_LIST = _.union(IGNORE_FILES, [".floo", ".idea"]),
  DEFAULT_IGNORES = ["extern", "node_modules", "tmp", "vendor", ".idea/workspace.xml", ".idea/misc.xml", ".git"],
  MAX_FILE_SIZE = 1024 * 1024 * 5,
  ROOT_PATH;

var MatchResult = {
  /** The file is not ignored, due to a rule saying its not ignored. */
  NOT_IGNORED : 1,

  /** The file is ignored due to a rule in this node. */
  IGNORED : 2,

  /** The ignore status is unknown, check inherited rules. */
  CHECK_PARENT : 3
};

var IgnoreRule = function(pattern) {
  this.pattern = pattern;
  self.negation = pattern.slice(0, 1) === "!";
  self.dirOnly = pattern.slice(-1) === "/";
};

IgnoreRule.prototype.isMatch = function(target, isDirectory) {
  var self = this;
  if (target === self.pattern) {
    if (self.dirOnly && !isDirectory) {
      return false;
    }
    return true;
  }
  if (minimatch(self.pattern, target)) {
    return true;
  }
  return false;
};

IgnoreRule.prototype.getResult = function() {
  return !this.negation;
};

var IgnoreNode = function() {
  this.rules = [];
};

IgnoreNode.prototype.addRule = function(rule) {
  this.rules.push(rule);
};

IgnoreNode.prototype.parse = function(text) {
  var self = this;

  text = text.replace(/\r\n/, '\n');
  _.each(text.split(/\n/), function(line) {
    var txt = line.trim();
    if (txt.length > 0 && txt.slice(0, 1) !== "#" && txt !== "/") {
      self.addRule(txt);
    }
  });
};

IgnoreNode.prototype.isIgnored = function(entryPath, isDirectory)  {
  var rule;
  if (rules.length === 0)
    return MatchResult.CHECK_PARENT;

  // Parse rules in the reverse order that they were read
  for (var i = rules.length - 1; i > -1; i--) {
    rule = rules[i];
    if (rule.isMatch(entryPath, isDirectory)) {
      if (!rule.negation)
        return MatchResult.IGNORED;
      else
        return MatchResult.NOT_IGNORED;
    }
  }
  return MatchResult.CHECK_PARENT;
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

Ignore.prototype.addRule = function(pattern) {
  pattern = path.join(this.path, pattern);
  this.addRule(pattern);
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
      self.addRule(".idea/workspace.xml");
      self.addRule(".idea/misc.xml");
      self.addRule(".git");
    }
  });
};

Ignore.prototype.getFiles = function() {
  var self = this,
    files = this.files.slice(0);

  _.each(self.children, function(child) {
    files.push.apply(files, child.getFiles());
  });

  return files;
};

Ignore.prototype.recurse = function (cb) {
  var self = this;

  fs.readDir(this.path, function(err, children) {
    if (err) return cb();

    async.each(children, function(file, cb) {
      var p = path.join(self.path, file);

      fs.lstat(p, function(err, stats) {
        var isDir, child;

        if (stats.isSymbolicLink() || stats.isBlockDevice() || stats.isCharacterDevice() || stats.isFIFO()) {
            return cb();
        }
        if (file.slice(0, 1) === "." && WHITE_LIST.indexOf(file) < 0) {
            return cb();
        }

        isDir = stats.isDirectory();
        if (self.isIgnoredDown(p, isDir)) {
            return cb();
        }
        if (isDir) {
            child = new Ignore(p, this, depth + 1);
            self.children[file] = child;
            child.recurse(function() {
              self.size += child.size;
              return cb();
            });
            return;
        }
        self.files.push(file);
        self.size += util.inspect(stats).size;
        cb();
      });
    }, cb);
  }, cb); 
};

Ignore.prototype.isIgnoredUp = function(path, isDir, split) {
  var self = this,
    nextName, ignore,
    ignored = self.ignoreNode.isIgnored(path, isDir);

  switch (ignored) {
    case IGNORED:
      return true;
    case NOT_IGNORED:
      return false;
    default:
      break;
  }

  if (split.length <= depth + 1) {
      return false;
  }
  nextName = split[depth + 1];
  ignore = children[nextName];
  return ignore && ignore.isIgnoredUp(path, isDir, split);
};

Ignore.prototype.isIgnoredDown = function(path, isDir) {
  var ignored = self.ignoreNode.isIgnored(path, isDir);
  switch (ignored) {
    case IGNORED:
      return true;
    case NOT_IGNORED:
      return false;
    default:
      break;
  }
  return this.parent && this.parent.isIgnoredDown(path, isDir);
};

Ignore.prototype._isFlooIgnored = function(file) {
  var parts,
    relative = path.relative(file, ROOT_PATH);

  if (relative.indexOf("..") >= 0) {
    console.log("Ignoring %s because it isn't shared.", file);
    return true;
  }
  if (file === self.path) {
    return false;
  }
  // if (virtualFile.is(VFileProperty.SPECIAL) || virtualFile.is(VFileProperty.SYMLINK)) {
  //     console.log("Ignoring %s because it is special or a symlink.", file);
  //     return true;
  // }
  parts = relative.split("/");
  for (var name in parts) {
    if (file.slice(0, 1) === "." && WHITE_LIST.indexOf(file) < 0) {
      console.log("Ignoring %s because it is hidden.", file);
      return true;
    }
  }
  // if (!virtualFile.isDirectory() && virtualFile.getLength() > MAX_FILE_SIZE) {
  //     console.log("Ignoring %s because it is too big (%s)", file, virtualFile.getLength());
  //     return true;
  // }
  return false;
};

Ignore.prototype.isIgnored = function(file, cb) {

  if (this._isFlooIgnored(file)) return cb(null, true);

  fs.lstat(file, function(err, stats) {
    if (err) {
      return cb(err);
    }
    var split = path.relative(file, ROOT_PATH).split("/"),
      isIgnored = this.isIgnoredUp(file, stats.isDirectory(), split);
    return cb(null, isIgnored);
  });
};

// public static void writeDefaultIgnores(FlooContext context) {
//     console.log("Creating default ignores.");
//     String path = FilenameUtils.concat(context.colabDir, ".flooignore");

//     try {
//         File f = new File(path);
//         if (f.exists()) {
//             return;
//         }
//         FileUtils.writeLines(f, DEFAULT_IGNORES);
//     } catch (IOException e) {
//         console.warn(e);
//     }
// }

exports.Ignore = Ignore;
exports.ROOT_PATH = ROOT_PATH;
