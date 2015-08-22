"use strict";

const utils = require("./utils");
const _ = require("lodash");
const fs = require("fs-plus");

function PersistentJson() {
  this.data = {};
  this.path = fs.absolute("~/floobits/persistent.json");
}

PersistentJson.prototype.load = function () {
  let d;
  try {
    /*eslint-disable no-sync */
    d = fs.readFileSync(this.path, {encoding: "utf8"});
    /*eslint-enable no-sync */
    this.data = JSON.parse(d);
  } catch (e) {
    console.error(e);
    this.data = {};
  }

  return this.data;
};

PersistentJson.prototype.update = function (path, url) {
  const recent_workspaces = this.data.recent_workspaces || [];
  let index = -1;
  _.each(recent_workspaces, function (w, i) {
    if (w.url === url) {
      index = i;
      return false;
    }
  });

  if (index >= 0) {
    recent_workspaces.splice(index, 1);
  }
  recent_workspaces.unshift({url: url});
  this.data.recent_workspaces = recent_workspaces;

  const floourl = utils.parse_url(url);
  if (!this.data.workspaces) {
    this.data.workspaces = {};
  }
  const workspaces = this.data.workspaces;
  if (!(floourl.owner in workspaces)) {
    workspaces[floourl.owner] = {};
  }
  const owner = workspaces[floourl.owner];
  if (!(floourl.workspace in owner)) {
    owner[floourl.workspace] = {};
  }
  const workspace = owner[floourl.workspace];
  workspace.path = path;
  workspace.url = url;
};

PersistentJson.prototype.write = function () {
  /*eslint-disable no-sync */
  fs.writeFileSync(this.path, JSON.stringify(this.data, null, 4), {encoding: "utf8"});
  /*eslint-enable no-sync */
};

module.exports = PersistentJson;
