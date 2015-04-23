/*global fl */
"use strict";

const async = require("async");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const url = require("url");
const _ = require("lodash");

const highlightColors = [
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

const __hasProp = {}.hasOwnProperty;
const inherits = function (child, parent) {
  // from CS :(
  let key;
  for (key in parent) {
    if (__hasProp.call(parent, key)) {
      child[key] = parent[key];
    }
  }
  function Ctor() {
    this.constructor = child;
  }
  Ctor.prototype = parent.prototype;
  child.prototype = new Ctor();
  child.__super__ = parent.prototype;
  return child;
};

function md5 (buffer) {
  return crypto.createHash("md5").update(buffer, "utf8").digest("hex");
}

function user_color (username) {
  var i = _.reduce(md5(username), function (memo, c) {
    return memo + c.charCodeAt(0);
  }, 0);

  return highlightColors[i % highlightColors.length];
}

function to_abs_path (base, rel) {
  return path.join(base, rel);
}

function to_rel_path (abs_path) {
  return path.relative(fl.base_path, abs_path);
}

function is_shared (base, p) {
  return path.relative(base, p).indexOf("..") === -1;
}

function patched_cleanly (result) {
  var clean_patch = true,
    i = 0;

  for (i; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  return clean_patch;
}

function is_binary (bytes, size) {
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
}

function walk_dir (p, cb) {
  var paths = [];

  fs.lstat(p, function (lstat_err, st) {
    if (lstat_err) {
      console.warn("Couldn't stat %s: %s", p, lstat_err);
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
    return fs.readdir(p, function (readdir_err, filenames) {
      if (readdir_err) {
        return cb(readdir_err, paths);
      }
      async.each(filenames,
        function (file, callback) {
          var abs_path = path.join(p, file);
          return walk_dir(abs_path, function (walkdir_err, sub_paths) {
            paths = paths.concat(sub_paths);
            callback(walkdir_err);
          });
        },
        function (err) {
          cb(err, paths);
        });
    });
  });
}

function load_floo (_path) {
  var floo_file, data = {};

  _path = path.join(_path, ".floo");

  try {
    /*jslint stupid: true */
    floo_file = fs.readFileSync(_path);
    /*jslint stupid: false */
    data = JSON.parse(floo_file);
  } catch (ignore) {
    // Unused
  }
  return data;
}

function parse_url (workspace_url) {
  var parsed_url,
    res,
    url_path,
    exit = function () {
      console.error("The workspace must be a valid url:", workspace_url);
    };

  try {
    parsed_url = url.parse(workspace_url);
  } catch (e) {
    return exit();
  }
  url_path = parsed_url.path;

  res = url_path.match(/\/r\/([\-\@\+\.\w]+)\/([\-\w]+)/) || url_path.match(/\/([\-\@\+\.\w]+)\/([\-\w]+)/);

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
}


function requestFullscreen (elem) {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  } else if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  }
}

function exitFullscreen () {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

function getFullscreenElement () {
  return document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement;
}

let uint8array;
if (typeof Uint8ClampedArray !== "undefined") {
  uint8array = Uint8ClampedArray = Uint8ClampedArray;
} else if (typeof Uint8Array !== "undefined") {
  uint8array = Uint8ClampedArray = Uint8Array;
} else {
  uint8array = Uint8ClampedArray = null;
}

module.exports = {
  requestFullscreen: requestFullscreen,
  exitFullscreen: exitFullscreen,
  getFullscreenElement: getFullscreenElement,
  inherits: inherits,
  to_abs_path: to_abs_path,
  to_rel_path: to_rel_path,
  is_binary: is_binary,
  md5: md5,
  load_floo: load_floo,
  is_shared: is_shared,
  parse_url: parse_url,
  patched_cleanly: patched_cleanly,
  user_color: user_color,
  Uint8ClampedArray: uint8array,
};
