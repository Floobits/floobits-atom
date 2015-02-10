var util = require("util");
var Emitter = require("./emitter");

function Transport() {
  Emitter.call(this);
}

util.inherits(Transport, Emitter);

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