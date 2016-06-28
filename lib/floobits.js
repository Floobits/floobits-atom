/*global self: true, fl */
"use strict";
"use babel";

self.fl = {};

const path = require("path");
const util = require("util");

const package_json = require("../package");
fl.PLUGIN_VERSION = package_json.version;

const _ = require("lodash");
const async = require("async");
const CompositeDisposable = require("atom").CompositeDisposable;
const Directory = require("atom").Directory;
const Disposable = require("atom").Disposable;
const File = require("atom").File;
const fs = require("fs-plus");
const open_url = require("open");

const api = require("./common/api");
const atomUtils = require("./atom_utils");
const message_action = require("./common/message_action");
const utils = require("./utils");
const usersModel = require("./common/user_model");
const prefs = require("./common/userPref_model");
const FlooUrl = require("./floourl").FlooUrl;
const buffer = require("./common/buffer_model");
const Filetree = require("./common/filetree_model");

const floop = require("./common/floop");
const floorc = require("./common/floorc");
const FlooHandler = require("./common/handlers/floohandler").FlooHandler;

module.exports = {
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
    fs_watch: {
      default: true,
      type: "boolean",
      description: "Enable file watcher. Without this, changes made outside of Atom may not be noticed and synced to the workspace."
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
      title: "Show User List Panel",
      default: true,
      type: "boolean",
      description: "Opens the User list panel when you join a workspace."
    },
    source_audio_id: {
      title: "Audio Device ID",
      type: "string",
      default: "",
      description: "The device ID of the audio input for WebRTC. Do not change manually - use 'Floobits: Audio Source' instead. "
    },
    source_audio_name: {
      title: "Audio Device Name",
      type: "string",
      default: "Default",
      description: "The device name of the audio input for WebRTC. Do not change manually - use 'Floobits: Audio Source' instead. "
    },
    source_video_id: {
      title: "Video Source ID",
      type: "string",
      default: "",
      description: "The device ID of the video input for WebRTC. Do not change manually - use 'Floobits: Video Source' instead. "
    },
    source_video_name: {
      title: "Video Source Name",
      type: "string",
      default: "Default",
      description: "The device name of the video input for WebRTC.  Do not change manually - use 'Floobits: Video Source' instead. "
    },
  },
  "term3-service": function (term3) {
    const that = this;
    const disposable = new Disposable(function () {
      that.terminal_manager.stop(true);
    }.bind(this));

    that.terminal_manager.on_term3_service(term3);

    return disposable;
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
      /* eslint-disable no-unused-vars */
      const view = new Sources(audio, function (err, source) {
        atom.config.set("floobits.source_" + type + "_id", source.id);
        atom.config.set("floobits.source_" + type + "_name", source.label);
      });
      /* eslint-enable no-unused-vars */
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

    this.terminal_manager = require("./terminal_manager");

    if (!_.size(floorc.auth)) {
      setTimeout(this.welcome.bind(this), 0);
    }

    atom.commands.add("atom-workspace", {
      "Floobits: Settings": this.open_settings.bind(this),
      "Floobits: Create Workspace": this.create_workspace.bind(this, null),
      "Floobits: Join Workspace": this.join_workspace.bind(this),
      "Floobits: Leave Workspace": this.leave_workspace.bind(this),
      // "Floobits: Join Recent Workspace": this.join_recent_workspace.bind(this),
      "Floobits: Audio Source": this.audioSources.bind(this),
      "Floobits: Video Source": this.videoSources.bind(this),
      "Floobits: Toggle User List Panel": that.user_list.bind(that),
      "Floobits: Setup": that.welcome.bind(that),
      "Floobits: Request Code Review": that.code_review.bind(that),
    });

    function onConfigUpdate (canJoin, config) {
      try {
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

        if (!pathToFloobits) {
          return;
        }
        const dir = utils.findDirectory(pathToFloobits);
        if (!dir) {
          return;
        }

        if (!config["atoms-api-sucks-url"]) {
          console.error("'floobits.atoms-api-sucks-url' isn't set?!? ");
          return;
        }
        atom.config.set("floobits.atoms-api-sucks-path", null);
        console.log("found pathToFloobits, will floobits");

        that.join_workspace_(pathToFloobits, config["atoms-api-sucks-url"]);
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
    console.debug("room_info", workspace);

    this.bufs.on_room_info(workspace);
    this.handler.on_room_info(workspace);

    _.each(workspace.terms, function (t) {
      const username = workspace.users[t.owner].username;
      t.owner = username;
      return t;
    });

    this.terminal_manager.on_floobits(this.me.id, workspace.terms);

    if (this.context_disposable) {
      return;
    }

    this.context_disposable = new CompositeDisposable();

    this.context_disposable.add(
      atom.commands.add(".tree-view .selected",
        "Floobits: Add to Workspace",
        this.add_file_from_menu.bind(this)
      )
    );
    const editorAction = require("./common/editor_action");
    this.context_disposable.add(
      atom.commands.add("atom-workspace", {
        "Floobits: Open Workspace in Browser": this.open_in_browser.bind(this),
        "Floobits: Summon": this.summon.bind(this),
        "Floobits: Follow User": this.follow.bind(this),
        "Floobits: Toggle Follow Mode": this.toggle_follow.bind(this),
        "Floobits: Add Current File": this.add_current_file.bind(this),
        "Floobits: Clear All Highlights": editorAction.clear_highlights,
        "Floobits: Workspace Permissions": this.permissions.bind(this),
        "Floobits: Chat": this.open_chat.bind(this),
      })
    );

    this.context_disposable.add(
      atom.contextMenu.add({
        ".tree-view .selected": [
          {
            label: "Floobits: Add to Workspace",
            command: "Floobits: Add to Workspace",
          },
        ],
        ".pane atom-text-editor": [
          {
            label: "Floobits: Add Current File",
            command: "Floobits: Add Current File",
          },
        ],
      })
    );
  },
  on_disconnect: function (msg) {
    msg = msg && msg.reason;
    message_action.warn(msg || "Disconnected from workspace", true);
    // We were disconnected for a reason. Don't reconnect.
    if (!msg) {
      return;
    }
    this.leave_workspace();
  },
  open_settings: function () {
    atom.workspace.open("atom://config/packages/floobits");
  },
  deactivate: function () {
    this.leave_workspace();
  },
  serialize: function () {
  },
  floourl: "",
  code_review: function () {
    const that = this;
    let url, directory;

    const dirs = atom.project.getDirectories();
    if (dirs.length < 1) {
      atom.confirm({
        message: "There is nothing to review!  You should open a folder first.",
        buttons: {"got it": function () {}}
      });
      return null;
    }

    const dialog_cb = function () {
      const code_review = require("./build/code_review");
      return code_review(function (unused, choice, description) {
        if (!choice) {
          return;
        }
        if (!url && that.handler && that.handler.floourl) {
          url = that.handler.floourl.toString();
        }
        if (!url) {
          return;
        }
        const parsed_url = utils.parse_url(url);
        api.post_code_review(parsed_url.host, parsed_url.owner, parsed_url.workspace, description, function (err, res) {
          let prompt = res.body.message;
          if (err) {
            prompt = err;
            console.error(err);
            return;
          }
          if (res.statusCode >= 400) {
            prompt = res.body;
            console.error(res.body);
            return;
          }

          atom.confirm({
            message: prompt,
            buttons: {"got it": function () {}}
          });
        });
      });
    };

    const review_cb = function (err, res) {
      let exists = true;
      if (err) {
        if (!res || res.statusCode !== 404) {
          console.error(err);
        }
        exists = false;
      }
      if (exists) {
        return dialog_cb();
      }
      const prompt = "Do you want to share " + directory.getPath() + "  so it can be reviewed?";
      const ync = require("./build/yes_no_cancel");
      return ync("Code Review", prompt, function (unused, choice) {
        if (choice !== "yes") {
          return;
        }
        const view = require("./build/create_workspace")({url: undefined, err: undefined, dir: directory});
        atomUtils.addModalPanel("create-workspace", view);
        const editorAction = require("./common/editor_action");
        const id = editorAction.onHANDLE_CONFLICTS(function () {
          editorAction.off(id);
          dialog_cb();
        });
        return;
      });
    };

    const dir_cb = function (err, dir) {
      if (err) {
        console.error(err);
        return null;
      }
      directory = dir;
      const dotFloo = utils.load_floo(directory.getPath());
      url = dotFloo && dotFloo.url;
      if (url) {
        return api.get_workspace_by_url(url, review_cb);
      }
      return review_cb(null, false);
    };

    let root;
    if (dirs.length === 1) {
      root = dirs[0];
      return dir_cb(null, root);
    }

    const DirectorySelectorView = require("./select_directory_to_share");
    /* eslint-disable no-unused-vars */
    const view = new DirectorySelectorView(dirs, dir_cb);
  },
  create_workspace: function (doesNotExist) {
    if (this.handler) {
      const that = this;
      const ync = require("./build/yes_no_cancel");
      const prompt = "You are connected to " + this.handler.floourl.toString() + ".  Really leave?";
      return ync("You are already connected to a workspace.", prompt, function (unused, choice) {
        if (choice !== "yes") {
          return;
        }
        that.leave_workspace();
        that.create_workspace(doesNotExist);
      });
    }
    const dirs = atom.project.getDirectories();
    if (dirs.length < 1) {
      atom.confirm({
        message: "There is nothing to share!  You should open a folder first.",
        buttons: {"got it": function () {}}
      });
      return null;
    }

    function cb (err, directory) {
      if (err) {
        console.error(err);
        return null;
      }
      const dotFloo = utils.load_floo(directory.getPath());
      let url = !doesNotExist && dotFloo && dotFloo.url;
      const _create_workspace = function (err2, res) {
        if (err2) {
          if (!res || res.statusCode !== 404) {
            console.error(err2);
          }
          url = null;
        }
        const view = require("./build/create_workspace")({url: url, err: err2, dir: directory});
        atomUtils.addModalPanel("create-workspace", view);
      };
      if (!url || doesNotExist) {
        return _create_workspace();
      }
      return api.get_workspace_by_url(url, _create_workspace);
    }

    let root;
    if (dirs.length === 1) {
      root = dirs[0];
      return cb(null, root);
    }

    const DirectorySelectorView = require("./select_directory_to_share");
    /* eslint-disable no-unused-vars */
    const view = new DirectorySelectorView(dirs, cb);
    /* eslint-enable no-unused-vars */
  },
  join_recent_workspace: function () {
    const recentworkspaceview = require("./recentworkspaceview");
    const view = new recentworkspaceview.RecentWorkspaceView();
    atom.workspace.addTopPanel({item: view});
    view.storeFocusedElement();
    view.focusFilterEditor();
  },
  join_workspace: function (event, directory) {
    const that = this;
    // let user pick
    const dirs = atom.project.getDirectories();

    if (dirs.length > 1 && !directory) {
      const DirectorySelectorView = require("./select_directory_to_share");
      /* eslint-disable no-unused-vars */
      const view = new DirectorySelectorView(dirs, function (err, selected_directory) {
      /* eslint-enable no-unused-vars */
        if (err) {
          throw new Error(err);
        }
        process.nextTick(that.join_workspace.bind(that, event, selected_directory));
      });
      return;
    }

    let root;
    if (directory) {
      root = directory.getPath();
    } else if (dirs.length === 1) {
      root = dirs[0].getPath();
    }

    let dotFloo, url;
    if (root) {
      dotFloo = utils.load_floo(root);
      url = dotFloo.url;
    }

    url = url || "https://floobits.com/";

    if (this.handler) {
      const ync = require("./build/yes_no_cancel");
      const prompt = "You are connected to " + this.handler.floourl + ".  Really leave?";
      ync("You are already connected to a workspace.", prompt, function (unused, choice) {
        if (choice !== "yes") {
          return;
        }
        that.leave_workspace();
        that.join_workspace(event, directory);
      });
      return;
    }

    const view = require("./build/join")({path: root || "", url: url, on_url: function (_path, _url) {
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
  join_workspace_: function (path, url, created) {
    const that = this;
    if (!path || !url) {
      throw new Error("need a path and url");
    }
    const parsed_url = utils.parse_url(url);
    if (_.isEmpty(parsed_url)) {
      console.error("bad url", url);
      return;
    }

    try {
      /* eslint-disable no-sync */
      path = fs.realpathSync(path);
      /* eslint-enable no-sync */
    } catch (e) {
      // TODO: better error behavior here. let user pick a directory or something
      message_action.error(util.format("Error calling fs.realpath(%s): %s", path, e.toString()));
      return;
    }
      // if (realPath !== path) {
      //   throw new Error("The directory you selected to share is a sym link which is currently not supported.  Please try opening " + realPath + "instead.");
      // }

    if (!utils.findDirectory(path)) {
      atom.open({pathsToOpen: [path]});
      let i = 0;
      const poll_atom = function () {
        i++;
        if (i > 50) {
          // ten seconds
          message_action.error("Atom didn't open the project. Try calling the floobits command again", true);
          return;
        }
        if (!utils.findDirectory(path)) {
          setTimeout(poll_atom, 200);
          return;
        }
        that.join_workspace_(path, url, created);
      };
      poll_atom();
      return;
    }

    // const dir = utils.findDirectory(path);
    // if (!dir) {
    //   throw new Error("floobits workspace path is not an opened folder in atom.\n", path);
    //   // atom.config.set("floobits.atoms-api-sucks-url", url);
    //   // atom.config.set("floobits.atoms-api-sucks-path", path);
    //   // message_action.log("Opening new window...", true);
    //   // atom.open({pathsToOpen: [path], newWindow: true});
    //   // return;
    // }

    const floourl = new FlooUrl(parsed_url.owner, parsed_url.workspace, parsed_url.host, parsed_url.port);
    api.get_workspace(parsed_url.host, parsed_url.owner, parsed_url.workspace, function (err, workspace) {
      if (err) {
        const res = workspace;
        if (res && res.statusCode === 404) {
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
      that.start(floourl, url, created, path);
    });
  },
  start: function (floourl, url, created, floobitsPath) {
    const that = this;

    that.leave_workspace();

    that.users = new usersModel.Users();
    const auth = this.auth = floorc.auth[floourl.host];
    that.me = new usersModel.User({id: auth.username});
    that.bufs = new buffer.Buffers();

    that.filetree = new Filetree();

    const floo = utils.load_floo(floobitsPath);
    floo.url = floourl.toString();
    utils.write_floo(floobitsPath, floo);

    fl.base_path = floobitsPath;
    fl.floourl = floourl;

    const PersistentJson = require("./persistentjson");
    const persistentJson = new PersistentJson();
    persistentJson.load();
    persistentJson.update(floobitsPath, url);
    persistentJson.write();

    floop.onROOM_INFO(that.on_room_info, that);
    floop.onDISCONNECT(that.on_disconnect, that);
    floop.onREQUEST_PERMS(that.on_request_perms, that);

    atom.commands.dispatch(atom.views.getView(atom.workspace), "tree-view:show");

    that.floourl = floourl;

    const AtomListener = require("./atom_listener");
    this.atom_listener = new AtomListener(that.bufs, that.users, that.me);
    this.atom_listener.start();
    const editorAction = require("./common/editor_action");
    editorAction.set(that.bufs, prefs);

    that.handler = new FlooHandler(floobitsPath, floourl, that.me, that.users, that.bufs, that.filetree, created);
    const WebRTC = require("./common/webrtc");
    that.webrtc = new WebRTC(that.users, that.me);
    const statusBar = require("./build/status_bar");
    const view = statusBar({floourl: floourl, me: that.me});
    const reactStatusBar = require("./react_wrapper").create_node("status-bar", view);
    that.statusBar = atom.workspace.addBottomPanel({item: reactStatusBar});

    that.open_chat();
    that.bufs.start();
    that.handler.start(auth);
    if (atom.config.get("floobits.userList")) {
      that.user_list();
    }
  },
  add_file_from_menu: function (event) {
    let paths;
    try {
      paths = atom.packages.getActivePackage("tree-view").mainModule.treeView.selectedPaths();
    } catch (e) {
      paths = [event.currentTarget.getPath()];
    }
    if (!paths.length) {
      return;
    }
    if (!this.handler) {
      message_action.error(`Error adding ${paths.join(", ")}: Not connected to a workspace.`);
      return;
    }
    for (let p of paths) {
      if (!utils.is_shared(p)) {
        message_action.error(`Error adding ${p}: Can't share file because it's not in ${fl.base_path}`);
        continue;
      }
      const rel = path.relative(fl.base_path, p);
      /* eslint-disable no-sync */
      if (fs.isFileSync(p)) {
        p = new File(p);
      } else if (fs.isDirectorySync(p)) {
        p = new Directory(p);
      } else {
        message_action.error(`Error adding ${rel}: Path is neither a file nor a directory. Maybe it's a symlink?`);
        continue;
      }
      /* eslint-enable no-sync */
      this.handler.get_paths_to_upload(p, (err, paths) => {
        if (err) {
          message_action.error(`Error adding ${rel}: ${err}`);
          return;
        }
        async.eachLimit(paths.toUpload, 10, (file, cb) => {
          this.handler.create_or_set(file, (err, res) => {
            if (err) {
              message_action.error(`Error adding ${rel}: ${err.toString()}`);
            } else {
              message_action.success(`Added ${rel}`);
            }
            return cb(err, res);
          });
        });
      });
    }
  },
  add_current_file: function () {
    // Doesn't handle binary yet.
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor || !_.isFunction(editor.getPath)) {
      message_action.error("Error adding current file: No active text editor. Currently, this feature only works with text files. Sorry.");
      return;
    }
    const p = editor.getPath();
    if (!utils.is_shared(p)) {
      message_action.error(`Error adding current file: Can't share ${p} because it's not in ${fl.base_path}`);
      return;
    }
    const buffer = editor.getBuffer();
    const text = buffer.getText();
    this.addBuf(text, p, "utf8");
  },
  addBuf: function (contents, bufPath, encoding) {
    const rel = path.relative(fl.base_path, bufPath);
    if (!this.handler) {
      message_action.error(`Error adding ${rel}: Not connected to a workspace.`);
      return;
    }
    if (!this.me || this.me.permissions.indexOf("create_buf") === -1) {
      message_action.error(`Error adding ${rel}: You don't have permission to create buffers in this workspace.`);
      return;
    }
    floop.send_create_buf({
      path: rel,
      buf: contents,
      encoding: encoding,
      md5: utils.md5(contents),
    });
  },
  user_list: function () {
    if (this.userPanel) {
      this.userPanel.destroy();
      return;
    }
    if (!this.handler) {
      message_action.error("Error listing users: Not connected to a workspace.");
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
    // special case -
    // this interacts when atom calls us, so we must keep it around
    this.terminal_manager.stop();

    if (this.context_disposable) {
      this.context_disposable.dispose();
      this.context_disposable = null;
    }

    if (this.atom_listener) {
      this.atom_listener.stop();
      this.atom_listener = null;
    }

    if (this.bufs) {
      this.bufs.stop();
      this.bufs = null;
    }

    if (this.handler) {
      message_action.error("Left " + this.handler.floourl.toString(), true);
      this.handler.stop();
      this.handler = null;
    }
    if (this.webrtc) {
      this.webrtc.stopUserMedia();
      this.webrtc = null;
    }

    if (this.userPanel) {
      this.userPanel.destroy();
      this.userPanel = null;
    }

    if (this.statusBar) {
      this.statusBar.destroy();
      this.statusBar = null;
    }
  },
  toggle_follow: function () {
    if (!this.handler) {
      return;
    }
    const editorAction = require("./common/editor_action");
    editorAction.follow();
  },
  follow: function () {
    if (!this.handler) {
      return;
    }
    const View = require("./follow_view");
    /* eslint-disable no-unused-vars */
    const view = new View(this.me, this.users);
    /* eslint-enable no-unused-vars */
  },
  summon: function () {
    if (!this.handler) {
      return;
    }

    const editor = atom.workspace.getActiveTextEditor();

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
  },
  open_chat: function () {
    if (!this.handler) {
      return;
    }
    const paneItem = _.find(atom.workspace.getPaneItems(), function (p) {
      return p.isFloobitsChat;
    });
    if (paneItem) {
      atom.workspace.getActivePane().activateItem(paneItem);
      return;
    }
    const MessagesView = require("./build/messages_view").MessagesView;
    const chatView = new MessagesView({
      messages: require("./common/message_model").Messages,
      username: this.me.id,
      focus: true,
    });
    const chatNode = require("./react_wrapper").create_node("chat", chatView,
      {width: "100%", height: "100%", overflow: "auto"}
    );

    const P = require("../templates/pane");
    const p = new P("Floobits Chat", "floobits-conflicts", chatNode);
    p.isFloobitsChat = true;

    atom.workspace.getActivePane().activateItem(p);
  },
  permissions: function () {
    if (!this.handler) {
      return;
    }
    const View = require("./build/edit_perms_view");
    const view = View({floourl: this.floourl, auth: this.auth});
    this.modalPanel = atomUtils.addModalPanel("edit_perms_view", view);
  }
};
