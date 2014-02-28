var tls = require('tls');

var log = require("floorine"),
  flooconn = require("./flooconn"),
  Floorc = require("./floorc").Floorc,
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  listener = require("./listener");

log.set_log_level("log");

var Floobits = function() {
  this.listener = new listener.Listener();
};

Floobits.prototype.join_workspace = function() {
  var floorc = new Floorc().load(),
    floourl = new FlooUrl("kansface", "asdf", "floobits.com", 3448);
  
  this.handler = new FlooHandler(floourl, floorc, "/floobits/asdf");
  this.handler.listen(this.listener);
  this.listener.start(); 
  this.handler.start();
};

Floobits.prototype.leave_workspace = function() {

};

module.exports = {
  floobits: new Floobits(),
  activate: function(state) {
    this.floobits.join_workspace();
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
