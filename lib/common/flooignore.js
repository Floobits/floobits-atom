"use strict";

const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const Minimatch = require("minimatch").Minimatch;
const utils = require("../utils");

const IGNORE_FILE = '.flooignore';


// const HIDDEN_WHITELIST = ['.floo'] + IGNORE_FILES;
const BLACKLIST = [
  '.DS_Store',
  '.git',
  '.svn',
  '.hg',
];

// # TODO: grab global git ignores:
// # gitconfig_file = popen("git config -z --get core.excludesfile", "r");
const DEFAULT_IGNORES = [
  '#*',
  '*.o',
  '*.pyc',
  '*~',
  'extern/',
  'node_modules/',
  'tmp',
  'vendor/',
];

const MAX_FILE_SIZE = 1024 * 1024 * 5;

const IS_IG_IGNORED = 1;
const IS_IG_CHECK_CHILD = 2;

function FlooIgnore() {
  this.ignores = [];
  this.unignores = [];
}

FlooIgnore.prototype.is_unignored = function(file, filePath) {
  filePath = filePath || file.getPath();
  for (let i in this.unignores) {
    if (this.unignores[i].match(filePath)) {
      return true;
    }
  }
};
FlooIgnore.prototype.is_ignored = function (file, filePath) {
  filePath = filePath || file.getPath();
  for (let i in this.ignores) {
    if (this.ignores[i].match(filePath)) {
      return true;
    }
  }
};

FlooIgnore.prototype.is_too_big = function(file, filePath) {
  filePath = filePath || file.getPath();
  try {
    const stats = fs.statSync(filePath);
    return stats.size <= MAX_FILE_SIZE;
  } catch (e) {
    console.error(e);
    return false;
  }
};
FlooIgnore.prototype.add_ignore = function (file) {
  const name = file.getBaseName();
  if (name !== IGNORE_FILE) {
    return;
  }

  let data;

  try {
    data = file.readSync();
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
    let prefix;
    if (line[0] === "/") {
      line = path.join(dir, line);
    } else {
      line = path.join(rel, "**", line);
    }

    if (line[line.length -1] === "/") {
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

FlooIgnore.prototype.watch = function (file) {
  
};

FlooIgnore.prototype.start = function (files) {
};

module.exports = FlooIgnore;