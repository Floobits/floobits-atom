var tls = require('tls');

var log = require("floorine"),
  _ = require('lodash'),
  util = require("util"),
  utils = require("./utils"),
  flooconn = require("./flooconn"),
  Floorc = require("./floorc").Floorc,
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  flooview = require("./floobitsview"),
  recentworkspaceview = require("./recentworkspaceview"),
  listener = require("./listener");

log.set_log_level("log");

var Floobits = function() {
  atom.workspaceView.command('floobits:JoinWorkspace', this.join_workspace.bind(this));
  atom.workspaceView.command('floobits:LeaveWorkspace', this.leave_workspace.bind(this));
  atom.workspaceView.command('floobits:JoinRecentWorkspace', this.join_recent_workspace.bind(this));
};

Floobits.prototype.join_recent_workspace = function() {
  var view = new recentworkspaceview.RecentWorkspaceView();
  // debugger;
  // view.initialize();
  // atom.workspaceView.append(view);
};

Floobits.prototype.join_workspace = function() {
  var self = this,
    floorc = new Floorc().load(),
    root = atom.project.getRootDirectory(), floo, floourl, parsed_url;

  floo = utils.load_floo(root.path);
  parsed_url = utils.parse_url(floo.url);
  floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
  self.handler = new FlooHandler(floourl, floorc, root.path);
  self.handler.start();
  self.FloobitsView = new flooview.FloobitsView(util.format("You joined: %s", floourl.toString()));
  atom.workspaceView.append(self.FloobitsView);
  setTimeout(function() {
    self.FloobitsView.empty();
  }, 3000);
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
    this.floobits = new Floobits();
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
