var tls = require('tls');

var flooconn = require("./flooconn"),
  Listener = require("./listener");

module.exports = {
  floobitsView: null,
  listener: null,
  activate: function(state) {
    this.listener = new Listener();
    this.listener.listen();
  },
  deactivate: function() {
  },
  serialize: function() {
  }
};
