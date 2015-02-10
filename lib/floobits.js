/*jslint nomen: true, todo: true */
/*global self: true */
"use strict";

var _ = require('lodash'),
  util = require("util"),
  utils = require("./utils"),
  prefs = require("./common/userPref_model"),
  FlooUrl = require("./floourl").FlooUrl,
  FlooHandler = require("./floohandler").FlooHandler,
  flooview = require("./floobitsview"),
  listener = require("./listener"),
  ReactWrapper = require("./react_wrapper"),
  msgAction = require("./common/message_action"),
  recentworkspaceview = require("./recentworkspaceview");

self.fl = {};

var Floobits = function () {
  atom.commands.add("atom-workspace", {
    "floobits:JoinWorkspace": this.join_workspace.bind(this),
    "floobits:LeaveWorkspace": this.leave_workspace.bind(this),
    "floobits:JoinRecentWorkspace": this.join_recent_workspace.bind(this),
  });
};

Floobits.prototype.join_recent_workspace = function () {
  var view = new recentworkspaceview.RecentWorkspaceView();
};

Floobits.prototype.join_workspace = function (url) {
  var self = this,
    floorc = utils.load_floorc(),
    root = atom.project.getRootDirectory(),
    floo,
    floourl,
    parsed_url;

  if (root) {
    floo = utils.load_floo(root.path);
    url = url || floo.url;
  }
  parsed_url = utils.parse_url(url);
  floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
  self.handler = new FlooHandler(floourl, floorc, root.path);
  self.handler.start();
  // self.FloobitsView = new flooview.FloobitsView();
  // atom.workspace.addTopPanel({item: self.FloobitsView});
  // setTimeout(function () {
    // self.FloobitsView.detach();
  // }, 3000);
};

Floobits.prototype.leave_workspace = function () {
  console.log("leaving");
  if (this.handler){
    this.handler.stop();
    this.handler = null;
  }
  listener.stop();
};

module.exports = {
  floobits: null,
  config: {
    audioOnly: {
      default: false,
      type: "boolean",
    },
    showNotifications: {
      default: true,
      type: "boolean",
    },
    mugshots: {
      default: true,
      type: "boolean",
    },
    sound: {
      default: true,
      type: "boolean",
    },
  },
  activate: function (state) {
    var floobits = new Floobits();
    this.floobits = floobits;

    function onConfigUpdate (config) {
      var diff = {}, 
      dir = atom.project.getRootDirectory(),
      pathToFloobits = config["atoms-api-sucks-path"];

      _.each(config, function (value, key) {
        if (_.has(prefs.schema, key) && prefs[key] !== value) {
          diff[key] = value;
        }
      });

      if (!_.isEmpty(diff)) {
        prefs.set(diff);
        console.log("updated user prefs", diff);
      }

      if (!dir || !pathToFloobits || dir.path !== pathToFloobits) {
        return;
      }

      if (!config['atoms-api-sucks-url']) {
        console.error("'floobits.atoms-api-sucks-url' isn't set?!? ");
        return;
      }
      atom.config.set('floobits.atoms-api-sucks-path', null);
      console.log("found pathToFloobits, will floobits");
      prefs.requestNotificationPermission();
      floobits.join_workspace(config['atoms-api-sucks-url']);
    }

    atom.config.observe('floobits', onConfigUpdate);

    onConfigUpdate(atom.config.get("floobits"));

    var React = require('react-atom-fork');
    var div = require('reactionary-atom-fork').div;
    var Component = React.createClass({
      displayName: 'Floobits React Wrapper',
      render: function () {
        return div("asdf");
      }
    });

    var Asdf = ReactWrapper("asdf");
    var asdf = new Asdf(Component(), ".floobits {color: red}");

    console.log("adding", asdf, "to top panel". asdf instanceof HTMLElement);
    // atom.workspace.addTopPanel({item: new ASDF()});
    atom.workspace.addTopPanel({
      item: asdf
    });
  },
  deactivate: function () {
    this.floobits.leave_workspace();
  },
  serialize: function () {
  }
};
