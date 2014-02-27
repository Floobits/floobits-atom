var path = require("path"),
  fs = require("fs");

var Floorc = function () {
  this.floorc = {};
  this.path = path.join(process.env[(process.platform === "win32") ? "USERPROFILE" : "HOME"], ".floorc");
}

Floorc.prototype.load = function() { 
  var floorc = this.floorc,
    floorc_lines;

  try {
    /*jslint stupid: true */
    floorc_lines = fs.readFileSync(this.path, "utf-8").split(os.EOL);
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
      value = line.slice(space + 1);
      floorc[key] = value;
    });
  } catch (e) {
    log.error("no ~/.floorc file was found");
  }
  return floorc;
};

exports.Floorc = Floorc;