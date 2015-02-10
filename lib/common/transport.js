var utils = require("../utils");

function Transport() {
  utils.Emitter.call(this);
}

utils.inherits(Transport, utils.Emitter);

Transport.prototype.connect = function () {
  throw new Error("not implemented");
};

Transport.prototype.disconnect = function () {
  throw new Error("not implemented");
};

Transport.prototype.write = function (name, msg, cb, context) {
  throw new Error("not implemented");
};

module.exports = Transport;