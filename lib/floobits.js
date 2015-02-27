/*jslint nomen: true, todo: true */
/*global self: true */
"use 6to5";
"use strict";

self.fl = {};

var _ = require('lodash'),
  api = require("./common/api"),
  util = require("util"),
  atomUtils = require("./atom_utils"),
  utils = require("./utils"),
  usersModel = require("./common/user_model"),
  prefs = require("./common/userPref_model"),
  FlooUrl = require("./floourl").FlooUrl,
  open_url = require("open"),
  buffer = require("./common/buffer_model"),
  Terminals = require("./common/terminal_model").Terminals,
  Filetree = require("./common/filetree_model"),
  path = require("path"),
  floop = require("./common/floop"),
  floorc = require("./common/floorc"),
  FlooHandler = require("./floohandler").FlooHandler;


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
    // Turn off metrics for everyone who installs our package
    // We include a note in our README, so this is OK!
    // atom.packages.disablePackage("metrics");

    atom.commands.add("atom-workspace", {
      "floobits: join workspace": this.join_workspace.bind(this),
      "floobits: leave workspace": this.leave_workspace.bind(this),
      "floobits: join recent workspace": this.join_recent_workspace.bind(this),
    });

    this.users = new usersModel.Users();
    this.me = new usersModel.User();
    this.bufs = new buffer.Buffers();
    this.terminals = new Terminals([], {users: this.users});
    this.filetree = new Filetree();
  

    function onConfigUpdate (canJoin, config) {
      try {
        const dir = atom.project.getRootDirectory();
        const pathToFloobits = config["atoms-api-sucks-path"];
        const diff = {};

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
  floourl: "",
  join_recent_workspace: function () {
    let recentworkspaceview = require("./recentworkspaceview");
    let view = new recentworkspaceview.RecentWorkspaceView();
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
    }

    url = url || "https://floobits.com/";

    var c = new JoinWorkspace({url: url, on_url: function (u) {
      if (!u) {
        return;
      }
      if (u !== url) {
        throw new Error("I need a path");
      }
      that.join_workspace_(root.path, u);
    }});
    c.show().focus();

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
    }
    var floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    api.get_workspace(parsed_url.host, parsed_url.owner, parsed_url.workspace, function (err, workspace) {
      if (err) {
        return console.error(err);
      }
      if (_.isEmpty(workspace)) {
        return console.error('empty workspace?!');
      }

      fl.base_path = path;
      // atom.commands.add("atom-workspace", {
      //   "floobits: open workspace in browser": this.open_in_browser.bind(this),
      //   "floobits: summon": this.summon.bind(this),
      //   "floobits: follow": this.follow.bind(this),
      // });

      this.floourl = floourl;
      this.handler = new FlooHandler(floourl, this.me, this.users, this.bufs, this.terminals, this.filetree);
      this.handler.start();
    }.bind(this));
  },
  open_in_browser: function () {
    if (this.handler && this.handler.floourl) {
      open_url(this.handler.floourl.toString());
    }
  },
  leave_workspace: function () {
    console.log("leaving");
    if (!this.handler){
      return;
    }
    this.handler.stop();
    this.handler = null;
  },
  follow: function () {
    if (!this.handler) {
      return;
    }
    let View = require("./follow_view");
    let view = new View(this.me, this.users);
    atom.workspace.addTopPanel({item: view});
    view.focusFilterEditor();
  },
  summon: function () {
    if (!this.handler) {
      return;
    }

    const editor = atom.workspace.getActiveEditor();
    
    if (!editor) {
      console.log("no active editor, I don't know what to do.");
      return;
    }

    const fluffer = this.bufs.findFluffer(editor);
    if (!fluffer || !fluffer.populated) {
      console.error("This file is not shared");
      return;
    }

    const ranges = atomUtils.rangeFromEditor(editor);

    floop.send_highlight({
      'id': fluffer.id,
      'ping': true,
      'summon': true,
      'following': false,
      'ranges': ranges,
    });
  }
};
