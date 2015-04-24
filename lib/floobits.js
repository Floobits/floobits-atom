/*global self: true, fl */
"use strict";
"use babel";

self.fl = {};

const _ = require("lodash");
const api = require("./common/api");
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

const floop = require("./common/floop");
const floorc = require("./common/floorc");
const FlooHandler = require("./common/handlers/floohandler").FlooHandler;

module.exports = {
  floobits: null,
  config: {
    audioOnly: {
      default: false,
      type: "boolean",
      description: "Disables video while video chatting."
    },
    showNotifications: {
      default: true,
      type: "boolean",
      description: "Enables Chrome desktop notifications."
    },
    mugshots: {
      default: false,
      type: "boolean",
      description: "Takes a snapshot every 60 seconds."
    },
    sound: {
      default: true,
      type: "boolean",
      description: "Plays sounds on join/part for other users for chatting."
    },
    userList: {
      title: "User List Panel",
      default: true,
      type: "boolean",
      description: "Opens the User list panel when you join a workspace."
    },
    source_audio_id: {
      title: "Audio Device ID",
      type: "string",
      default: "-1",
      description: "The device ID of the audio input for WebRTC.  Do not change manually!"
    },
    source_audio_name: {
      title: "Audio Device Name",
      type: "string",
      default: "Default",
      description: "The device name of the audio input for WebRTC.  Do not change manually!"
    },
    source_video_id: {
      title: "Video Source ID",
      type: "string",
      default: "-1",
      description: "The device id of the video input for WebRTC.  Do not change manually!"
    },
    source_video_name: {
      title: "Video Source Name",
      type: "string",
      default: "-1",
      description: "The device name of the video input for WebRTC.  Do not change manually!"
    },
  },
  welcome: function () {
    const Webview = require("./build/webview");
    const view = new Webview();
    const constants = require("./common/constants");
    view.load(constants.HOST);
  },
  mediaSource_: function (type) {
    MediaStreamTrack.getSources(function (sources) {
      const audio = sources.filter(function (s) {
        return s.kind === type;
      });
      const Sources = require("./media_sources");
      const view = new Sources(audio, function (source) {
        atom.config.set("floobits.source_" + type + "_id", source.id);
        atom.config.set("floobits.source_" + type + "_name", source.label);
      });
      atom.workspace.addTopPanel({item: view});
      view.focusFilterEditor();
    });
  },
  audioSources: function () {
    this.mediaSource_("audio");
  },
  videoSources: function () {
    this.mediaSource_("video");
  },
  activate: function () {
    const that = this;

    // Turn off metrics for everyone who installs our package
    // We include a note in our README, so this is OK!
    // atom.packages.disablePackage("metrics");
    if (!_.size(floorc.auth)) {
      setTimeout(this.welcome.bind(this), 0);
    }
    atom.commands.add("atom-workspace", {
      "floobits: create workspace": this.create_workspace.bind(this),
      "floobits: join workspace": this.join_workspace.bind(this),
      "floobits: leave workspace": this.leave_workspace.bind(this),
      "floobits: join recent workspace": this.join_recent_workspace.bind(this),
      "floobits: audio source": this.audioSources.bind(this),
      "floobits: video source": this.videoSources.bind(this),
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

        if (!config["atoms-api-sucks-url"]) {
          console.error("'floobits.atoms-api-sucks-url' isn't set?!? ");
          return;
        }
        atom.config.set("floobits.atoms-api-sucks-path", null);
        console.log("found pathToFloobits, will floobits");

        that.join_workspace_(dir.path, config["atoms-api-sucks-url"]);
      } catch (e) {
        console.error(e);
      }
    }

    atom.config.observe("floobits", onConfigUpdate.bind(null, false));
    onConfigUpdate(true, atom.config.get("floobits"));
  },
  on_request_perms: function (data) {
    const user = this.users.getByConnectionID(data.user_id);
    if (!user) {
      return;
    }
    const handleRequestPerm = require("./build/handle_request_perm");
    const view = handleRequestPerm({username: user.username, userId: data.user_id, perms: data.perms});
    atomUtils.addModalPanel("handle-request-perm", view);
  },
  on_room_info: function (workspace) {
    console.log("foobar on_room_info", workspace);
    if (this.statusBar) {
      return;
    }
    const statusBar = require("./build/status_bar");
    const userId = workspace.user_id;
    const user = workspace.users[userId];
    if (!user) {
      return;
    }
    const view = statusBar({owner: workspace.owner, workspace: workspace.room_name, username: user.username});
    const reactStatusBar = require("./react_wrapper").create_node("status_bar", view);
    this.statusBar = atom.workspace.addBottomPanel({item: reactStatusBar});
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
  create_workspace: function (doesNotExist) {
    const root = atom.project.getRootDirectory();
    let dotFloo;
    if (root) {
      const cwd = root.getPath();
      dotFloo = utils.load_floo(cwd);
    }
    let url = !doesNotExist && dotFloo && dotFloo.url;
    const _create_workspace = function (err, res) {
      if (err) {
        if (res.statusCode !== 404) {
          console.error(err);
        }
        url = null;
      }
      const view = require("./build/create_workspace")({url: url, err: err});
      atomUtils.addModalPanel("create-workspace", view);
    };
    if (!url || doesNotExist) {
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
    atomUtils.addModalPanel("join-workspace", view);
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
      atom.config.set("floobits.atoms-api-sucks-url", url);
      atom.config.set("floobits.atoms-api-sucks-path", path);
      message_action.log("Opening new window...", true);
      atom.open({pathsToOpen: [path], newWindow: true});
      return;
    }

    const that = this;
    const floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    api.get_workspace(parsed_url.host, parsed_url.owner, parsed_url.workspace, function (err, workspace) {
      if (err) {
        const res = workspace;
        if (res.statusCode === 404) {
          const ync = require("./build/yes_no_cancel");
          return ync("404!", "The workspace " + floourl.toString() + " does not exist.  Do you want to create it?", function (unused, choice) {
            if (choice !== "yes") {
              return;
            }
            that.create_workspace(true);
          });
        }
        message_action.error(err, true);
        return console.error(err);
      }
      if (_.isEmpty(workspace)) {
        message_action.error("empty workspace?!", true);
        return console.error("empty workspace?!");
      }
      this.leave_workspace();
      fl.base_path = path;
      atom.commands.add("atom-workspace", {
        "floobits: open workspace in browser": this.open_in_browser.bind(this),
        "floobits: summon": this.summon.bind(this),
        "floobits: follow": this.follow.bind(this),
        "floobits: user list panel": this.user_list.bind(this),
      });
      const PersistentJson = require("./persistentjson");
      const persistentJson = new PersistentJson();
      persistentJson.load();
      persistentJson.update(path, url);
      persistentJson.write();

      floop.onROOM_INFO(this.on_room_info, this);
      floop.onDISCONNECT(this.on_disconnect, this);
      floop.onREQUEST_PERMS(this.on_request_perms, this);

      this.floourl = floourl;
      this.handler = new FlooHandler(floourl, this.me, this.users, this.bufs, this.terminals, this.filetree);
      this.handler.start();
      if (atom.config.get("floobits.userList")) {
        this.user_list();
      }
      const WebRTC = require("./common/webrtc");
      this.webrtc = new WebRTC(this.users, this.me);
    }.bind(this));
  },
  user_list: function () {
    if (this.userPanel) {
      this.userPanel.destroy();
      return;
    }
    const pane = require("./build/user_list_pane");
    const view = pane({users: this.users, me: this.me, prefs: prefs});

    this.userPanel = atomUtils.addRightPanel("users", view, {width: "230px", height: "100%", overflow: "auto"});
    this.userPanel.onDidDestroy(function () {
      this.userPanel = null;
    }.bind(this));
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
      this.userPanel = null;
    }
    if (this.statusBar) {
      this.statusBar.destroy();
      this.statusBar = null;
    }
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
      "id": fluffer.id,
      "ping": true,
      "summon": true,
      "following": false,
      "ranges": ranges,
    });
  }
};
