/*jslint nomen: true, todo: true */
"use strict";

var async = require("async");
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var url = require("url");
var _ = require("lodash");

var __hasProp = {}.hasOwnProperty;
var inherits = function (child, parent) {
  // from CS :(
  for (var key in parent) {
    if (__hasProp.call(parent, key)) child[key] = parent[key];
  }
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
  child.__super__ = parent.prototype;
  return child;
};

var highlightColors = [
  "lime",
  "black",
  "blue",
  "darkblue",
  "fuchsia",
  "gray",
  "green",
  "greenyellow",
  "indigo",
  "magenta",
  "midnightblue",
  "maroon",
  "orange",
  "orangered",
  "purple",
  "red",
  "teal",
  "yellow"
];

var user_color = function (username) {
  var i = _.reduce(md5(username), function (memo, c) {
    return memo + c.charCodeAt(0);
  }, 0);

  return highlightColors[i % highlightColors.length];
};

var md5 = function (buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
};

var to_abs_path = function (base, rel) {
  return path.join(base, rel);
};

var is_shared = function (base, p) {
  return path.relative(base, p).indexOf("..") === -1;
};

var patched_cleanly = function (result) {
  var clean_patch = true,
    i = 0;

  for (i; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  return clean_patch;
};

var is_binary = function (bytes, size) {
  var i,
    max_bytes = 512,
    suspicious_bytes = 0,
    total_bytes;

  if (size === 0) {
    return false;
  }

  total_bytes = Math.min(size, max_bytes);

  if (size >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    // UTF-8 BOM. This isn't binary.
    return false;
  }
  /*jslint continue: true */
  for (i = 0; i < total_bytes; i++) {
    if (bytes[i] === 0) { // NULL byte--it's binary!
      return true;
    }
    if ((bytes[i] < 7 || bytes[i] > 14) && (bytes[i] < 32 || bytes[i] > 127)) {
      // UTF-8 detection
      if (bytes[i] > 191 && bytes[i] < 224 && i + 1 < total_bytes) {
        i++;
        if (bytes[i] < 192) {
          continue;
        }
      } else if (bytes[i] > 223 && bytes[i] < 239 && i + 2 < total_bytes) {
        i++;
        if (bytes[i] < 192 && bytes[i + 1] < 192) {
          i++;
          continue;
        }
      }
      suspicious_bytes++;
      // Read at least 32 bytes before making a decision
      if (i > 32 && (suspicious_bytes * 100) / total_bytes > 10) {
        return true;
      }
    }
  }
  /*jslint continue: false */
  if ((suspicious_bytes * 100) / total_bytes > 10) {
    return true;
  }

  return false;
};


var walk_dir = function (p, cb) {
  var paths = [];

  fs.lstat(p, function (err, st) {
    if (err) {
      console.warn("Couldn't stat %s: %s", p, err);
      return cb(null, paths);
    }
    // Ignore hidden files. Yeah I know this is lame and you can put hidden files in a repo/room.
    if (_.contains([".svn", ".git", ".hg"], path.basename(p))) {
      return cb(null, paths);
    }
    if (!st.isDirectory()) {
      paths.push(p);
      return cb(null, paths);
    }
    return fs.readdir(p, function (err, filenames) {
      if (err) {
        return cb(err, paths);
      }
      async.each(filenames,
        function (file, callback) {
          var abs_path = path.join(p, file);
          walk_dir(abs_path, function (err, sub_paths) {
            paths = paths.concat(sub_paths);
            callback(err);
          });
        },
        function (err) {
          cb(err, paths);
        });
    });
  });
};

var load_floo = function (_path) {
  var floo_file, data = {};

  _path = path.join(_path, ".floo");

  try {
    /*jslint stupid: true */
    floo_file = fs.readFileSync(_path);
    /*jslint stupid: false */
    data = JSON.parse(floo_file);
  } catch (ignore) {}
  return data;
};

var load_floorc = function () {
  var floorc = {},
    floorc_path;

  try {
    floorc_path = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc.json");

    /*jslint stupid: true */
    floorc = JSON.parse(fs.readFileSync(floorc_path, "utf-8"));
    /*jslint stupid: false */
  } catch (e) {
    console.error("No valid ~/.floorc.json file was found.");
  }
  return floorc;
};

var parse_url = function (workspace_url) {
  var parsed_url,
    res,
    path,
    exit = function () {
      console.error('The workspace must be a valid url:', workspace_url);
    };

  try {
    parsed_url = url.parse(workspace_url);
  } catch (e) {
    return exit();
  }
  path = parsed_url.path;

  res = path.match(/\/r\/([\-\@\+\.\w]+)\/([\-\w]+)/) || path.match(/\/([\-\@\+\.\w]+)\/([\-\w]+)/);

  if (!res) {
    return exit();
  }

  return {
    host: parsed_url.hostname,
    port: parsed_url.protocol === "http" ? 3148 : 3448,
    owner: res[1],
    secure: parsed_url.protocol === "https",
    workspace: res[2]
  };
};

module.exports = {
  inherits: inherits,
  to_abs_path: to_abs_path,
  is_binary: is_binary,
  md5: md5,
  load_floo: load_floo,
  is_shared: is_shared,
  parse_url: parse_url,
  patched_cleanly: patched_cleanly,
  load_floorc: load_floorc,
  user_color: user_color
};
