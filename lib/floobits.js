var tls = require('tls');

var log = require("floorine"),
fs = require("fs"),
  _ = require('lodash'),
  util = require("util"),
  utils = require("./utils"),
  flooconn = require("./flooconn"),
  Floorc = require("./floorc").Floorc,
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  flooview = require("./floobitsview"),
  recentworkspaceview = require("./recentworkspaceview"),
  persistentjson = require("./persistentjson"),
  asdf = require("./asdf"),
  listener = require("./listener");

log.set_log_level("log");

var Floobits = function() {
  fs.appendFileSync('/floobits/log.txt', "opened \n");
  atom.workspaceView.command('floobits:JoinWorkspace', this.join_workspace.bind(this));
  atom.workspaceView.command('floobits:LeaveWorkspace', this.leave_workspace.bind(this));
  atom.workspaceView.command('floobits:JoinRecentWorkspace', this.join_recent_workspace.bind(this));
  var f = atom.emit;
  atom.emit = function() {
    fs.appendFileSync('/floobits/log.txt', "atom workspace " + arguments[0] + " \n");
    console.log("atom.workspace", arguments[0]);
    f.apply(this, arguments);
  };

  var g = atom.workspace.emit;
  atom.workspace.emit = function() {
    fs.appendFileSync('/floobits/log.txt', "atom " + arguments[0] + " \n");
    console.log("atom", arguments[0]);
    g.apply(this, arguments);
  };

  var h = atom.workspaceView.emit;
  atom.workspaceView.emit = function() {
    fs.appendFileSync('/floobits/log.txt', "atom workspaceView " + arguments[0] + " \n");
    console.log("atom", arguments[0]);
    h.apply(this, arguments);
  };

  var i = atom.workspaceView.emit;
  atom.project.emit = function() {
    fs.appendFileSync('/floobits/log.txt', "atom project " + arguments[0] + " \n");
    console.log("atom", arguments[0]);
    i.apply(this, arguments);
  };

  atom.workspace.on("uri-opened-subscription-added", function(){
    debugger;
  });
};

Floobits.prototype.join_recent_workspace = function() {
  var self = this, pj, recent_workspaces, items, view;
  pj = new persistentjson.PersistentJson().load();
  recent_workspaces = _.pluck(pj.recent_workspaces, "url");
  items = recent_workspaces.map(function(workspace) {
    var p, stuff = utils.parse_url(workspace);
    try{
      p = pj.workspaces[stuff.owner][stuff.workspace].path;
    } catch(e) {
      p = "?";
    }
    return {
      path: p,
      url: workspace
    };
  });
  view = new recentworkspaceview.RecentWorkspaceView(items, function(err, item){
    self.join_workspace(item.url, item.path);  
  });
  atom.workspaceView.append(view);
  view.focusFilterEditor();
};

Floobits.prototype.join_workspace = function(floourl, _path) {
  var self = this,
    floo,
    floorc = new Floorc().load(),
    root = _path || atom.project.getRootDirectory()._path;

  if (!floourl) {
    floo = utils.load_floo(root);
    floourl = floo.url;
  }
  floourl = new FlooUrl(floourl);
  // fs.writeFileSync(path.join(_path, ".floobits-atom-hack"), floourl.toString());
  // atom.open({ _pathsToOpen: [_path]});
  
  self.handler = new FlooHandler(floourl, floorc, root);
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
  floobits: new Floobits(),
  activate: function(state) {
  },
  deactivate: function() {
    this.floobits.leave_workspace();
  },
  serialize: function() {
  }
};
