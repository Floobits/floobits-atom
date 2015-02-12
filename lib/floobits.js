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
  create_node = require("./react_wrapper").create_node,
  msgAction = require("./common/message_action"),
  recentworkspaceview = require("./recentworkspaceview");

self.fl = {};

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
    var that = this;

    atom.commands.add("atom-workspace", {
      "floobits:JoinWorkspace": this.join_workspace.bind(this),
      "floobits:LeaveWorkspace": this.leave_workspace.bind(this),
      "floobits:JoinRecentWorkspace": this.join_recent_workspace.bind(this),
    });

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
      that.join_workspace(config['atoms-api-sucks-url']);
    }

    atom.config.observe('floobits', onConfigUpdate);

    onConfigUpdate(atom.config.get("floobits"));
  },
  deactivate: function () {
    this.leave_workspace();
  },
  serialize: function () {
  },
  join_recent_workspace: function () {
    var view = new recentworkspaceview.RecentWorkspaceView();
    atom.workspace.addTopPanel({item: view});
    view.focusFilterEditor();
  },
  join_workspace: function (url) {
    var floorc = utils.load_floorc(),
      root = atom.project.getRootDirectory(),
      floo,
      floourl,
      parsed_url;

    fl.base_path = root.path;
    if (root) {
      floo = utils.load_floo(root.path);
      url = url || floo.url;
    }
    parsed_url = utils.parse_url(url);
    floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    this.handler = new FlooHandler(floourl, floorc);
    this.handler.start();
  },
  leave_workspace: function () {
    console.log("leaving");
    if (!this.handler){
      return;
    }
    this.handler.stop();
    this.handler = null;
  },
};
