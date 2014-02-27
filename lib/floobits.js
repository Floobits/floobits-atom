var tls = require('tls');

var flooconn = require("./flooconn"),
  Listener = require("./listener");

function Floobits () {
  this.listener = new Listener();
};

Floobits.prototype.join_workspace = function() {
  var floorc = new floorc.Floorc(),
    floourl = new floourl.FlooUrl("kansface", "asdf", "floobits.com", 3448);

  floorc.load();  
  
  this.handler = new FlooHandler(floourl, floorc);
  this.handler.start();
};

F.prototype.leave_workspace = function() {

};

module.exports = {
  floobits: new Floobits();
  activate: function(state) {
    this.floobits.join_workspace();
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
