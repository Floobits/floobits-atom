var tls = require('tls');

var log = require("floorine"),
  _ = require('lodash'),
  utils = require("./utils"),
  flooconn = require("./flooconn"),
  Floorc = require("./floorc").Floorc,
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  flooview = require("./floobitsview"),
  listener = require("./listener");

log.set_log_level("log");

var Floobits = function() {
  atom.workspaceView.command('floobits:JoinWorkspace', this.join_workspace.bind(this));
  atom.workspaceView.command('floobits:LeaveWorkspace', this.leave_workspace.bind(this));
};

Floobits.prototype.join_workspace = function() {
  var floorc = new Floorc().load(),
    root = atom.project.getRootDirectory(), floo, floourl, parsed_url;

  floo = utils.load_floo(root.path);
  parsed_url = utils.parse_url(floo.url);
  floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
  this.handler = new FlooHandler(floourl, floorc, root.path);
  this.handler.start();
};

Floobits.prototype.leave_workspace = function() {
  console.log("leaving");
  if (this.handler){
    this.handler.stop();
    this.handler = null;
  } 
};

module.exports = {
  floobits: null,
  activate: function(state) {
    this.FloobitsView = new flooview.FloobitsView();
    atom.workspaceView.append(this.FloobitsView);
    this.floobits = new Floobits();
    var original = atom.project.rootDirectory.emit;
    atom.project.rootDirectory.emit = function() {
      console.log(arguments);
      original.apply(this, _.toArray(arguments));
    };
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
