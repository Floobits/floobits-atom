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

    function onConfigUpdate (canJoin, config) {
      var diff = {}, dir, pathToFloobits;

      try {
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

        if (!canJoin) {
          return;
        }

        prefs.requestNotificationPermission();

        if (!dir || !pathToFloobits || dir.path !== pathToFloobits) {
          return;
        }

        if (!config['atoms-api-sucks-url']) {
          console.error("'floobits.atoms-api-sucks-url' isn't set?!? ");
          return;
        }
        atom.config.set('floobits.atoms-api-sucks-path', null);
        console.log("found pathToFloobits, will floobits");

        that.join_workspace_(dir.path, config['atoms-api-sucks-url']);  
      } catch (e) {
        console.error(e);
      }
      
    }

    atom.config.observe('floobits', onConfigUpdate.bind(null, false));

    onConfigUpdate(true, atom.config.get("floobits"));
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
  join_workspace: function () {
    var JoinWorkspace = require("../templates/join");
    var that = this;
    var dotFloo, url;
    var root = atom.project.getRootDirectory();

    if (root) {
      dotFloo = utils.load_floo(root.path);
      url = dotFloo.url;
    } else {
      url = "https://floobits.com/";
    }

    var c = new JoinWorkspace({url: url, on_url: function (u) {
      if (!u) {
        throw new Error("I need a url");
      }
      if (u !== url) {
        throw new Error("I need a path");
      }
      that.join_workspace_(root.path, u);
    }});
  },
  join_workspace_: function (path, url) {
    if (!path || !url) {
      throw new Error("need a path and url");
    }
    var floorc = utils.load_floorc();
    var parsed_url = utils.parse_url(url);
    if (_.isEmpty(parsed_url)) {
      console.error("bad url", url);
      return;
    };
    var floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    fl.base_path = path;
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
