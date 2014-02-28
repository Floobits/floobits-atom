var path = require("path"),
  os = require("os"),
  fs = require("fs");

var log = require("floorine"),
  _ = require("lodash");

var Floorc = function () {
  this.floorc = {};
  this.path = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc");
};

Floorc.prototype.load = function() { 
  var self = this,
    floorc_lines;

  try {
    /*jslint stupid: true */
    floorc_lines = fs.readFileSync(this.path, "utf-8");
    floorc_lines = floorc_lines.split(os.EOL);
    /*jslint stupid: false */
    _.each(floorc_lines, function (line) {
      var space,
        key,
        value;
      /*jslint regexp: true */
      if (line.match(/^\s*#.*/)) {
        return;
      }
      /*jslint regexp: false */
      space = line.indexOf(" ");
      key = line.slice(0, space).toLowerCase();
      if (key.length <= 0) {
        return;
      }
      value = line.slice(space + 1);
      self.floorc[key] = value;
    });
  } catch (e) {
    console.error("no ~/.floorc file was found");
  }
  return self;
};

exports.Floorc = Floorc;