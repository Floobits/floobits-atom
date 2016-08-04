/*global fl, Uint8ClampedArray: true */
"use strict";

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

/*eslint-disable no-control-regex */
const CRRegex = new RegExp("\r", "g");
const LFRegex = new RegExp("\n", "g");
/*eslint-enable no-control-regex */

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

const unix_path_regex = new RegExp("/", "g");
function to_abs_path (rel_posix_path) {
  return path.join(fl.base_path, rel_posix_path.replace(unix_path_regex, path.sep));
}

const os_path_regex = new RegExp(/\\/g);
function to_unix_path (p) {
  return p.replace(os_path_regex, "/");
}

function to_rel_path (abs_path) {
  return to_unix_path(path.relative(fl.base_path, abs_path));
}

function is_shared (p) {
  if (!p) {
    return false;
  }
  return to_rel_path(p).indexOf("..") === -1;
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
  // Max bytes to compare
  const max_bytes = 512;

  if (size === 0) {
    return false;
  }

  const total_bytes = Math.min(size, max_bytes);

  bytes = bytes.slice(0, total_bytes);
  if (_.isString(bytes)) {
    bytes = new TextEncoder("utf8").encode(bytes);
  }

  if (!_.isTypedArray(bytes)) {
    throw new Error("is_binary: Can't convert to Uint8Array!");
  }

  if (size >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    // UTF-8 BOM. This isn't binary.
    return false;
  }

  if (size > 4) {
    const head = bytes.slice(0, 5);
    const pdf = [37, 80, 68, 70, 45]; //"%PDF-"
    if (_.every(head, (v, i) => {
      return v === pdf[i];
    })) {
      /* PDF. This is binary. */
      return true;
    }
  }

  let suspicious_bytes = 0;
  for (let i = 0; i < total_bytes; i++) {
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
  if ((suspicious_bytes * 100) / total_bytes > 10) {
    return true;
  }

  return false;
}

function load_floo (_path) {
  var floo_file, data = {};

  _path = path.join(_path, ".floo");
  console.debug("Loading floo file", _path);

  try {
    /*eslint-disable no-sync */
    floo_file = fs.readFileSync(_path, {
      encoding: "utf8",
    });
    /*eslint-enable no-sync */
    data = JSON.parse(floo_file);
  } catch (ignore) {
    // Unused
  }
  return data;
}

function write_floo (_path, data) {
  _path = path.join(_path, ".floo");

  console.debug("Writing floo file", _path);
  try {
    /*eslint-disable no-sync */
    fs.writeFileSync(_path, JSON.stringify(data, null, "    "));
    /*eslint-enable no-sync */
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

  res = url_path.match(/^\/([\-\@\+\.\w]+)\/([\-\.\w]+)\/?.*$/);
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

const BROWSER_CLIENTS = [
  "Atom",
  "Chrome",
  "Firefox",
  "IE",
  "Opera",
  "Safari",
  "web",
];

function findDirectory (pathToFloobits) {
  const dirs = atom.project.getDirectories();
  return _.find(dirs, function (d) {
    // TODO: normalize paths before compare
    /* eslint-disable no-sync */
    return d.getRealPathSync() === pathToFloobits;
    /* eslint-enable no-sync */
  });
}

function padNum (padNum) {
  var n;
  n = padNum.toString(10);
  if (n.length < 2) {
    return "0" + n;
  }
  return n;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

const ONEMINUTE = 1000 * 60;
const ONEYEAR = ONEMINUTE * 60 * 60 * 24 * 365;

function formatDate (date) {
  const month = MONTHS[date.getMonth()];
  const h = date.getHours();
  const year = date.getFullYear();
  const hour = padNum(h);
  const day = padNum(date.getDate());
  const minute = padNum(date.getMinutes());
  const second = padNum(date.getSeconds());
  const alongtimeago = date.getTime() < (new Date().getTime() - ONEYEAR);
  const ashortimeago = date.getTime() > (new Date().getTime() - (ONEMINUTE * 3));
  const formatted = [
    month,
    " ",
    (alongtimeago ? year + " " : ""),
    day,
    " ",
    hour,
    ":",
    minute,
    (ashortimeago ? ":" + second : ""),
    " ",
  ].join("");
  return {
    date: date,
    formatted: formatted,
    month: month,
    day: day,
    hour: hour,
    minute: minute,
    second: second,
    year: year,
    alongtimeago: alongtimeago,
    ashortimeago: ashortimeago,
    meridian: h < 12 ? "AM" : "PM",
  };
}

function formatBytes (bytes) {
  if (bytes === 0) {
    return '0 bytes';
  }
  const k = 1000;
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const extensions_to_mime = {
  "bmp": "bmp",
  "cgm": "cgm",
  "g3": "g3fax",
  "gif": "gif",
  "ief": "ief",
  "jp2": "jp2",
  "jpeg": "jpeg",
  "jpg": "jpeg",
  "jpe": "jpeg",
  "pict": "pict",
  "pic": "pict",
  "pct": "pict",
  "png": "png",
  "btif": "prs.btif",
  "svg": "svg+xml",
  "svgz": "svg+xml",
  "tiff": "tiff",
  "tif": "tiff",
  "psd": "vnd.adobe.photoshop",
  "djvu": "vnd.djvu",
  "djv": "vnd.djvu",
  "dwg": "vnd.dwg",
  "dxf": "vnd.dxf",
  "fbs": "vnd.fastbidsheet",
  "fpx": "vnd.fpx",
  "fst": "vnd.fst",
  "mmr": "vnd.fujixerox.edmics-mmr",
  "rlc": "vnd.fujixerox.edmics-rlc",
  "mdi": "vnd.ms-modi",
  "npx": "vnd.net-fpx",
  "wbmp": "vnd.wap.wbmp",
  "xif": "vnd.xiff",
  "ras": "x-cmu-raster",
  "cmx": "x-cmx",
  "ico": "x-icon",
  "pntg": "x-macpaint",
  "pnt": "x-macpaint",
  "mac": "x-macpaint",
  "pcx": "x-pcx",
  "pnm": "x-portable-anymap",
  "pbm": "x-portable-bitmap",
  "pgm": "x-portable-graymap",
  "ppm": "x-portable-pixmap",
  "qtif": "x-quicktime",
  "qti": "x-quicktime",
  "rgb": "x-rgb",
  "xbm": "x-xbitmap",
  "xpm": "x-xpixmap",
  "xwd": "x-xwindowdump"
};

function image_mime_from_extension (name) {
  var extension = name.split(".").slice(-1);
  try {
    extension = extension[0].toLowerCase();
    return extensions_to_mime[extension];
  } catch (e) {
    console.log("image_mime_from_extension:", e);
  }
  return null;
}


let uint8array;
if (typeof Uint8ClampedArray !== "undefined") {
  uint8array = Uint8ClampedArray;
} else if (typeof Uint8Array !== "undefined") {
  uint8array = Uint8ClampedArray = Uint8Array;
} else {
  uint8array = Uint8ClampedArray = null;
}

module.exports = {
  CRRegex,
  LFRegex,
  formatDate,
  formatBytes,
  image_mime_from_extension: image_mime_from_extension,
  padNum: padNum,
  requestFullscreen: requestFullscreen,
  exitFullscreen: exitFullscreen,
  getFullscreenElement: getFullscreenElement,
  inherits: inherits,
  to_abs_path: to_abs_path,
  to_rel_path: to_rel_path,
  is_binary: is_binary,
  md5: md5,
  load_floo: load_floo,
  write_floo: write_floo,
  is_shared: is_shared,
  parse_url: parse_url,
  patched_cleanly: patched_cleanly,
  user_color: user_color,
  findDirectory: findDirectory,
  Uint8ClampedArray: uint8array,
  BROWSER_CLIENTS: BROWSER_CLIENTS,
};
