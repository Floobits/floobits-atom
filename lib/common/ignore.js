"use strict";

const fs = require("fs");
const path = require("path");

const _ = require("lodash");
const Minimatch = require("minimatch").Minimatch;

const utils = require("./utils");

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


// const IS_IG_IGNORED = 1;
// const IS_IG_CHECK_CHILD = 2;

function Ignore() {
  this.ignores = [];
  this.unignores = [];
  this.repo = null;
}

Ignore.prototype.init = function (directory, cb) {
  /* eslint-disable no-sync */
  this.dir_path = directory.getRealPathSync();
  const pretend_path = path.join(this.dir_path, IGNORE_FILE);
  /* eslint-enable no-sync */
  _.each(BLACKLIST, this.add_ignore_entry_.bind(this, pretend_path));
  this.create_flooignore_(this.dir_path);
  atom.project.repositoryForDirectory(directory).then((repo) => {
    this.repo = repo;
    return cb();
  }, cb);
};

Ignore.prototype.create_flooignore_ = function () {
  const flooignore = path.join(this.dir_path, IGNORE_FILE);
  try {
    /*eslint-disable no-sync */
    if (!fs.existsSync(flooignore)) {
      fs.writeFileSync(flooignore, DEFAULT_IGNORES.join("\n"));
    }
    /*eslint-enable no-sync */
  } catch (e) {
    console.error(e);
  }
  try {
    /*eslint-disable no-sync */
    const data = fs.readFileSync(flooignore, {
      encoding: "utf8",
    });
    /*eslint-enable no-sync */
    _.each(data.split(/\n/), this.add_ignore_entry_.bind(this, flooignore));
  } catch (e) {
    console.error(e);
  }
};

Ignore.prototype.is_unignored_ = function (filePath) {
  for (let i in this.unignores) {
    if (this.unignores[i].match(filePath)) {
      return true;
    }
  }
  return false;
};

Ignore.prototype.is_ignored_ = function (filePath) {
  for (let i in this.ignores) {
    if (this.ignores[i].match(filePath)) {
      return true;
    }
  }
  return false;
};

Ignore.prototype.is_ignored = function (absOSPath) {
  const gitIgnored = this.repo && this.repo.isPathIgnored(absOSPath) && absOSPath !== this.dir_path;
  const flooIgnored = this.is_ignored_(absOSPath);
  if (gitIgnored || flooIgnored) {
    if (this.is_unignored_(absOSPath)) {
      return false;
    }
    return true;
  }
  return false;
};

Ignore.prototype.getSize = function (filePath) {
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

Ignore.prototype.is_too_big = function (size) {
  return size > MAX_FILE_SIZE;
};

Ignore.prototype.add_ignore_entry_ = function (filePath, line) {
  if (!line) {
    return;
  }
  const dir = path.dirname(filePath);
  const rel = utils.to_rel_path(dir);

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
  if (negate) {
    this.unignores.push(match);
  } else {
    this.ignores.push(match);
  }
};

Ignore.prototype.add_ignore = function (file) {
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

  /* eslint-disable no-sync */
  const p = file.getRealPathSync();
  /* eslint-enable no-sync */
  _.each(data.split(/\n/), this.add_ignore_entry_.bind(this, p));
};

module.exports = new Ignore();
