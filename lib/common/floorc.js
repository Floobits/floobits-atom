var path = require("path");
var floorc = {};
var fs = require("fs");
var _ = require("lodash");

var p = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc.json");

function reloadFloorc() {
  var auth;
  try {
    _.merge(floorc, JSON.parse(fs.readFileSync(p)));
  } catch (e) {
    console.error(e);
    return;
  }
}

fs.watch(p, reloadFloorc);
reloadFloorc();

module.exports = floorc;
