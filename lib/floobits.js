var _ = require('lodash'),
  util = require("util"),
  utils = require("./utils"),
  flooconn = require("./flooconn"),
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  flooview = require("./floobitsview"),
  listener = require("./listener"),
  recentworkspaceview = require("./recentworkspaceview");

var Floobits = function() {
  listener.start();
  atom.workspaceView.command('floobits:JoinWorkspace', this.join_workspace.bind(this));
  atom.workspaceView.command('floobits:LeaveWorkspace', this.leave_workspace.bind(this));
  atom.workspaceView.command('floobits:JoinRecentWorkspace', this.join_recent_workspace.bind(this));
};

Floobits.prototype.join_recent_workspace = function() {

  var view = new recentworkspaceview.RecentWorkspaceView();
  // new asdf();
};

Floobits.prototype.join_workspace = function(url) {
  var self = this,
    floorc = utils.load_floorc(),
    root = atom.project.getRootDirectory(), floo, floourl, parsed_url;

  floo = utils.load_floo(root.path);
  parsed_url = utils.parse_url(url || floo.url);
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
    var pathToFloobits = atom.config.get('floobits.atoms-api-sucks-path');

    if (atom.project.getRootDirectory().path == pathToFloobits) {
      atom.config.set('floobits.atoms-api-sucks-path', null);
      console.log("found pathToFloobits, will floobits");
      this.floobits.join_workspace(atom.config.get('floobits.atoms-api-sucks-url'));
    }
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
