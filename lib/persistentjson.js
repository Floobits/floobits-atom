var util = require("util"),
  fs = require("fs-plus");

function PersistentJson() {
  this.data = {};
}

PersistentJson.prototype.load = function() {
  var p = fs.absolute("~/floobits/persistent.json"),
    d = fs.readFileSync(p, {encoding: "utf8"});
 
  this.data = JSON.parse(d);
  return this.data;
};

exports.PersistentJson = PersistentJson;