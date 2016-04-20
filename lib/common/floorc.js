"use strict";

const fs = require("fs");
const path = require("path");

const _ = require("lodash");

const p = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc.json");
let floorc = {};

function reloadFloorc() {
  let data = {auth: {}};
  try {
    /*eslint-disable no-sync */
    data = JSON.parse(fs.readFileSync(p, {
      encoding: "utf8",
    }));
    /*eslint-enable no-sync */
  } catch (e) {
    console.warn(e);
  }
  try {
    _.merge(floorc, data);
  } catch (e) {
    console.error(e);
    return;
  }
}

floorc.__write = function () {
  /*eslint-disable no-sync */
  fs.writeFileSync(p, JSON.stringify(floorc, null, 4));
  /*eslint-enable no-sync */
};

try {
  fs.watch(p, reloadFloorc);
} catch (e) {
  console.warn(e);
}

reloadFloorc();

module.exports = floorc;
