"use strict";

var path = require("path");
var floorc = {};
var fs = require("fs");
var _ = require("lodash");

var p = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc.json");

function reloadFloorc() {
  let data = {auth: {}};
  try {
    data = JSON.parse(fs.readFileSync(p))
  } catch (e) {
    console.error(e);
  }
  try {
    _.merge(floorc, data);
  } catch (e) {
    console.error(e);
    return;
  }
}

floorc.__path = p;
floorc.__write = function () {
  fs.writeFileSync(p, JSON.stringify(floorc, null, 4));
}
fs.watch(p, reloadFloorc);
reloadFloorc();

module.exports = floorc;
