var util = require("util"),
  utils = require("./utils");

function FlooUrl(ownerOrUrl, workspace, host, port) {
  var parsed;
  if (!workspace) {
    parsed = utils.parse_url(ownerOrUrl);
    this.owner = parsed.owner;
    this.workspace = parsed.workspace;
    this.host = parsed.host;
    this.port = parsed.port;
  } else {
    this.owner = ownerOrUrl;
    this.workspace = workspace;
    this.host = host;
    this.port = port;    
  }

}

FlooUrl.prototype.toString = function() {
  return util.format("https://%s:%s/%s/%s", this.host, this.port, this.owner, this.workspace);
};

exports.FlooUrl = FlooUrl;