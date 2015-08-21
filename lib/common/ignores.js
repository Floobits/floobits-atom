"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const Minimatch = require("minimatch").Minimatch;
const utils = require("../utils");

const IGNORE_FILE = ".flooignore";


// const HIDDEN_WHITELIST = [".floo"] + IGNORE_FILES;
const BLACKLIST = [
  ".DS_Store",
  ".git",
  ".svn",
  ".hg",
];

const DEFAULT_IGNORES = [
  "#*",
  "*.o",
  "*.pyc",
  "*~",
  "extern/",
  "node_modules/",
  "tmp",
  "vendor/",
];

const MAX_FILE_SIZE = 1024 * 1024 * 5;

var flooIgnore;

// const IS_IG_IGNORED = 1;
// const IS_IG_CHECK_CHILD = 2;

function Ignores() {
  this.ignores = [];
  this.unignores = [];
}


Ignores.prototype.init = function (directory, cb) {
  const that = this;
  this.dir_path = directory.getPath();
  atom.project.repositoryForDirectory(directory)
  .then(function (err) {
    return cb(err);
  }, function (repo) {
    that.repo = repo;
    return cb();
  });
};

Ignores.prototype.is_unignored_ = function (filePath) {
  for (let i in this.unignores) {
    if (this.unignores[i].match(filePath)) {
      return true;
    }
  }
};

Ignores.prototype.is_ignored_ = function(filePath) {
  for (let i in this.ignores) {
    if (this.ignores[i].match(filePath)) {
      return true;
    }
  }
};

Ignores.prototype.is_ignored = function (filePath) {
  const gitIgnored = this.repo && this.repo.isPathIgnored(p) && p !== this.dir_path;
  const flooIgnored = this.is_ignored_(p);
  if (gitIgnored || flooIgnored) {
    if (this.is_unignored_(p)) {
      return false;
    }
    return true;
  }
  return false;
};

Ignores.prototype.getSize = function (filePath) {
  try {
    /*eslint-disable no-sync */
    const stats = fs.statSync(filePath);
    /*eslint-enable no-sync */
    return stats.size;
  } catch (e) {
    console.error(e);
    return 0;
  }
};

Ignores.prototype.is_too_big = function (size) {
  return size > MAX_FILE_SIZE;
};

Ignores.prototype.stop = function () {

};

Ignores.prototype.add_ignore = function (file) {
  const name = file.getBaseName();
  if (name !== IGNORE_FILE) {
    return;
  }

  let data;

  try {
    /*eslint-disable no-sync */
    data = file.readSync();
    /*eslint-enable no-sync */
  } catch (e) {
    console.error(e);
    return;
  }

  const that = this;
  const filePath = file.getPath();
  const dir = path.dirname(filePath);
  const rel = utils.to_rel_path(dir);

  _.each(data.split(/\n/), function (line) {
    if (!line) {
      return;
    }
    // console.log("s:", line);
    const negate = line[0] === "!";
    if (negate) {
      line = line.slice(1);
    }
    if (line[0] === "/") {
      line = path.join(dir, line);
    } else {
      line = path.join(rel, "**", line);
    }

    if (line[line.length - 1] === "/") {
      line += "**";
    }
    const match = new Minimatch(line);
    if (negate){
      that.unignores.push(match);
    } else {
      that.ignores.push(match);
    }
    // console.log("e:", line);
  });
};

module.exports = new Ignores();
