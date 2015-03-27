/*jslint nomen: true, todo: true */
/*global self: true */
"use babel";
"use strict";

self.fl = {};

const  _ = require('lodash');
const api = require("./common/api");
const util = require("util");
const atomUtils = require("./atom_utils");
const message_action = require("./common/message_action");
const utils = require("./utils");
const usersModel = require("./common/user_model");
const prefs = require("./common/userPref_model");
const FlooUrl = require("./floourl").FlooUrl;
const open_url = require("open");
const buffer = require("./common/buffer_model");
const Terminals = require("./common/terminal_model").Terminals;
const Filetree = require("./common/filetree_model");
const path = require("path");
const floop = require("./common/floop");
const floorc = require("./common/floorc");
const FlooHandler = require("./common/handlers/floohandler").FlooHandler;

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
      default: false,
      type: "boolean",
    },
    sound: {
      default: true,
      type: "boolean",
    },
  },
  welcome: function () {
    const that = this;
    const View = require("./build/welcome");
    const view = View({create_account: function (username, password, email) {
      that.leave_workspace();
      const AccountHandler = require("./common/handlers/account");
      that.handler = new AccountHandler(username, password, email);
      that.handler.start();
    }});
    const wrapper = require("./react_wrapper");
    const welcome = wrapper.create_node('welcome', view,
      {width: "100%", height: "100%", overflow: "auto"}
    );

    const P = require('../templates/pane');
    const p = new P("Welcome to Floobits", "", welcome);
    atom.workspace.getActivePane().activateItem(p);

  },
  activate: function (state) {
    const that = this;
    // Turn off metrics for everyone who installs our package
    // We include a note in our README, so this is OK!
    // atom.packages.disablePackage("metrics");
    // TODO: enable if no creds found
    // setTimeout(this.welcome.bind(this), 0);
    atom.commands.add("atom-workspace", {
      "floobits: create workspace": this.create_workspace.bind(this),
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
        // Deprecation: Use ::getDirectories instead
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
    floop.onROOM_INFO(this.on_room_info, this);
    floop.onDISCONNECT(this.on_disconnect, this);
    floop.onREQUEST_PERMS(this.on_request_perms, this);
  },
  on_request_perms: function (data) {
    const user = this.users.getByConnectionID(data.user_id);
    if (!user) {
      return;
    }
    const HandleRequestPerm = require("./build/handle_request_perm");
    const view = HandleRequestPerm({username: user.username, userId: data.user_id, perms: data.perms});
    const wrapper = require("./react_wrapper").create_node('handle-request-perm', view,
      {width: "100%", height: "100%", overflow: "auto"}
    );
    const pane = atom.workspace.addModalPanel({item: wrapper});
    wrapper.onDestroy(pane);
  },
  on_room_info: function (workspace) {
    console.log("foobar on_room_info", workspace);
    if (this.statusBar) {
      return;
    }
    const StatusBar = require("./build/status_bar");
    const userId = workspace.user_id;
    const user = workspace.users[userId];
    if (!user) {
      return;
    }
    const view = StatusBar({owner: workspace.owner, workspace: workspace.room_name, username: user.username});
    const statusBar = require("./react_wrapper").create_node('status_bar', view,
      {width: "228px", height: "100%", overflow: "auto"}
    );
    this.statusBar = atom.workspace.addBottomPanel({item: statusBar});

  },
  on_disconnect: function () {
    console.log("foobar on_disconnect...", arguments);
    if (this.statusBar) {
      this.statusBar.destroy();
    }
  },
  deactivate: function () {
    this.leave_workspace();
  },
  serialize: function () {
  },
  floourl: "",
  create_workspace: function () {
    const root = atom.project.getRootDirectory();
    let dotFloo;
    if (root) {
      const cwd = root.getPath();
      dotFloo = utils.load_floo(cwd);
    }
    const url = dotFloo && dotFloo.url;
    const _create_workspace = function (err, res) {
      const view = require("./build/create_workspace")({url: url, err: err});
      const wrapper = require("./react_wrapper").create_node('create-workspace', view,
        {width: "100%", height: "100%", overflow: "auto"}
      );
      const pane = atom.workspace.addModalPanel({item: wrapper});
      wrapper.onDestroy(pane);
    };
    if (!url) {
      return _create_workspace();
    }
    return api.get_workspace_by_url(url, _create_workspace);
  },
  join_recent_workspace: function () {
    const recentworkspaceview = require("./recentworkspaceview");
    const view = new recentworkspaceview.RecentWorkspaceView();
    atom.workspace.addTopPanel({item: view});
    view.focusFilterEditor();
  },
  join_workspace: function () {
    const that = this;
    let dotFloo, url;
    const root = atom.project.getRootDirectory();

    if (root) {
      dotFloo = utils.load_floo(root.path);
      url = dotFloo.url;
    }

    url = url || "https://floobits.com/";

    const view = require("./build/join")({url: url, on_url: function (_path, _url) {
      if (!_url) {
        message_action.error("I need a URL!");
        return;
      }
      if (!_path) {
        message_action.error("I need a directory!");
        return;
      }
      that.join_workspace_(_path, _url);
    }});
    const wrapper = require("./react_wrapper").create_node('join-workspace', view,
      {width: "100%", height: "100%", overflow: "auto"}
    );
    const pane = atom.workspace.addModalPanel({item: wrapper});
    wrapper.onDestroy(pane);
  },
  join_workspace_: function (path, url) {
    if (!path || !url) {
      throw new Error("need a path and url");
    }
    const parsed_url = utils.parse_url(url);
    if (_.isEmpty(parsed_url)) {
      console.error("bad url", url);
      return;
    }

    const root = atom.project.getRootDirectory();
    if (!root || root.getPath() !== path) {
      atom.config.set('floobits.atoms-api-sucks-url', url);
      atom.config.set('floobits.atoms-api-sucks-path', path);
      message_action.log("Opening new window...", true);
      atom.open({pathsToOpen: [path], newWindow: true});
      return;
    }

    const floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    api.get_workspace(parsed_url.host, parsed_url.owner, parsed_url.workspace, function (err, workspace) {
      if (err) {
        message_action.error(error, true);
        return console.error(err);
      }
      if (_.isEmpty(workspace)) {
        message_action.error('empty workspace?!', true);
        return console.error('empty workspace?!');
      }
      this.leave_workspace();
      fl.base_path = path;
      atom.commands.add("atom-workspace", {
        "floobits: open workspace in browser": this.open_in_browser.bind(this),
        "floobits: summon": this.summon.bind(this),
        "floobits: follow": this.follow.bind(this),
        "floobits: video": this.video.bind(this),
      });
      const PersistentJson = require("./persistentjson");
      const persistentJson = new PersistentJson();
      persistentJson.load();
      persistentJson.update(path, url);
      persistentJson.write();

      this.floourl = floourl;
      this.handler = new FlooHandler(floourl, this.me, this.users, this.bufs, this.terminals, this.filetree);
      this.handler.start();
      const WebRTC = require("./common/webrtc");
      this.webrtc = new WebRTC(this.users, this.me);
    }.bind(this));
  },
  video: function () {
    if (this.userPanel) {
      return;
    }
    const UserlistView = require("./build/user_view").UserlistView;
    const view = UserlistView({users: this.users, me: this.me, prefs: prefs});
    const users = require("./react_wrapper").create_node('users', view,
      {width: "228px", height: "100%", overflow: "auto"}
    );
    this.userPanel = atom.workspace.addRightPanel({item: users});
  },
  open_in_browser: function () {
    if (this.handler && this.handler.floourl) {
      open_url(this.handler.floourl.toString());
    }
  },
  leave_workspace: function () {
    message_action.log("Leaving workspace", true);
    console.log("leaving");
    if (!this.handler){
      return;
    }
    this.handler.stop();
    this.handler = null;
    if (this.userPanel) {
      this.userPanel.destroy();
    }

    this.userPanel = null;
  },
  follow: function () {
    if (!this.handler) {
      return;
    }
    const View = require("./follow_view");
    const view = new View(this.me, this.users);
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
