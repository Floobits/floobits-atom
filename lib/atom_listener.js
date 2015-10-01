/*global fl */
"use strict";
"use babel";

const _ = require("lodash");
const atomUtils = require("./atom_utils");
const bufferAction = require("./common/buffer_action");
const CompositeDisposable = require("atom").CompositeDisposable;
const editorAction = require("./common/editor_action");
const floop = require("./common/floop");
const fs = require("fs-plus");
const path = require("path");
const prefs = require("./common/userPref_model");
const utils = require("./utils");

const IMAGINARY_ID = -1;

function AtomListener (bufs, users, me) {
  this.bufs = bufs;
  this.users = users;
  this.atomEditors = {};
  this.atomBuffers = {};
  this.disposables = null;
  this.send_patch_for = {};
  this.highlight_data_by_username = {};
  this.markers_by_conn_id = {};
  this.buffersSaved = {};
  this.movedFiles = {};
  this.highlightToSend = null;
  this.lastHighlightReceived = null;
  this.handledConflicts = false;
  this.username = me.id;
  this.me = me;
  // set of buffer IDS
  this.shouldSave = {};
}

AtomListener.prototype.onDidChange = function (buffer) {
  if (this.ignore_events) {
    return;
  }

  if (!buffer.floobitsID) {
    console.warn(buffer.getPath(), " is in project but not shared (and it changed).");
  }

  this.send_patch_for[buffer.floobitsID] = true;
};

AtomListener.prototype.onDidStopChanging = function (buffer) {
  if (!floop.connected) {
    return;
  }
  const bufferID = buffer.floobitsID;
  const fluffer = this.bufs.get(bufferID);

  if (!fluffer) {
    return;
  }

  if (this.send_patch_for[bufferID]) {
    if (fluffer.populated) {
      console.log("sending patch");
      fluffer.send_patch([buffer.getText()]);
    }
    this.send_patch_for[bufferID] = false;
  }

  if (this.highlightToSend && this.highlightToSend.id === bufferID) {
    floop.send_highlight(this.highlightToSend);
    this.highlightToSend = null;
  }

  if (_.size(this.buffersSaved)) {
    const saves = {};
    _.each(this.buffersSaved, function (id) {
      if (id !== bufferID) {
        saves[id] = true;
        return;
      }
      floop.send_saved({id: id});
    });
    this.buffersSaved = saves;
  }
};

AtomListener.prototype.onDidSave = function (buffer) {
  var fluffer = this.bufs.get(buffer.floobitsID);

  if (this.ignore_events) {
    return;
  }
  if (!fluffer) {
    // TODO: send create buf if no fluffer
    return;
  }
  if (!fluffer.populated) {
    return;
  }
  if (this.send_patch_for[fluffer.id]) {
    this.buffersSaved[fluffer.id] = true;
    return;
  }
  floop.send_saved({id: fluffer.id});
};

AtomListener.prototype.onDidChangeSelectionRange = function (editor) {
  if (this.ignore_events) {
    return;
  }

  const fluffer = this.bufs.findFluffer(editor);
  if (!fluffer || !fluffer.populated) {
    return;
  }

  const ranges = atomUtils.rangeFromEditor(editor);

  const highlight = {
    "id": fluffer.id,
    "ping": false,
    "summon": false,
    "following": false,
    "ranges": ranges,
  };

  if (this.send_patch_for[fluffer.id]) {
    this.highlightToSend = highlight;
  } else {
    floop.send_highlight(highlight);
  }
};

AtomListener.prototype.onDidChangePath = function (buffer, newPath) {
  if (this.ignore_events) {
    return;
  }

  if (newPath in this.movedFiles) {
    delete this.movedFiles[newPath];
    return;
  }

  const oldFluffer = this.bufs.get(buffer.floobitsID);
  const fluffer = this.bufs.findFluffer(buffer);

  let oldPath;
  if (oldFluffer) {
    oldPath = oldFluffer.path;
  }

  buffer.floobitsID = fluffer ? fluffer.id : IMAGINARY_ID;

  const rel = path.relative(fl.base_path, newPath);
  const shared = rel.indexOf("..") === -1;

  if (oldPath) {
    if (!shared) {
      floop.send_delete_buf({id: oldFluffer.id});
      return;
    }
    if (!fluffer) {
      floop.send_rename_buf({id: oldFluffer.id, path: rel});
      return;
    }
    // moved to a shared location somehow!
    console.warn("buffer moved on top of another!", oldFluffer.path, fluffer.path);
    floop.send_delete_buf({id: fluffer.id});
    floop.send_rename_buf({id: oldFluffer.id, path: rel});
    return;
  }

  if (!shared) {
    return;
  }
  const text = buffer.getText();
  floop.send_create_buf({
    path: rel,
    buf: text,
    encoding: "utf8",
    md5: utils.md5(text),
  });
};


AtomListener.prototype.bindTo_ = function (obj, events) {
  const that = this;
  const disposables = new CompositeDisposable();

  _.each(events, function (eventName) {
    function action () {
      var args = _.toArray(arguments);
      args.unshift(obj);
      that[eventName].apply(that, args);
    }
    disposables.add(obj[eventName](action));
  });

  disposables.add(obj.onDidDestroy(function () {
    delete obj.floobitsID;

    if (that.disposables) {
      that.disposables.remove(disposables);
    }

    try {
      disposables.dispose();
    } catch (e) {
      console.error(e);
    }
  }));

  this.disposables.add(disposables);
};

AtomListener.prototype.on_floobits_highlight = function (data) {
  var fluffer, editors, markers, markers_by_conn_id = this.markers_by_conn_id;
  const user_id = data.user_id;

  if (!data || _.size(data.ranges) === 0) {
    return;
  }

  fluffer = this.bufs.get(data.id);

  if (!fluffer || !fluffer.populated) {
    return;
  }

  markers = markers_by_conn_id[user_id];
  if (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
    delete markers_by_conn_id[user_id];
  }

  editors = this.atomEditors[data.id] || [];
  this.atomEditors[data.id] = _.filter(editors, function (e) {
    return e.isAlive();
  });

  let following = prefs.isFollowing(data.username) || data.summon;

  if (!editors || !editors.length) {
    if (following) {
      atom.workspace.open(fluffer.abs_path()).done(function (editor) {
        this.on_floobits_highlight(data);
        console.debug("Highlighted in", editor);
      }.bind(this));
    }
    return;
  }

  markers_by_conn_id[user_id] = [];

  let klass = "floobits-highlight-dark_" + utils.user_color(data.username);

  let toActivate = [];
  _.each(editors, function (editor) {
    var buffer;

    buffer = editor.buffer;
    if (!buffer) {
      return;
    }

    if (!buffer.isAlive()) {
      console.log("dead buffer?!");
      return;
    }

    _.map(data.ranges, function (range) {
      if (range[0] === range[1]) {
        range[1]++;
      }
      return atomUtils.offsetToBufferRange(buffer, range[0], range[1]);
      // startRow = offsetIndex.totalTo(range[0], 'characters').rows;
      // colStart = range[0] - offsetIndex.totalTo(startRow, "rows").characters;
      // endRow   = offsetIndex.totalTo(range[1], 'characters').rows;
      // colEnd   = range[1] - offsetIndex.totalTo(endRow, "rows").characters;
      // if (startRow === endRow && colStart === colEnd) {
      //   line = buffer.lineForRow(endRow);
      //   if (line && line.length == colEnd) {
      //     colStart -= 1;
      //   } else {
      //     colEnd += 1;
      //   }
      // }
      // return new AtomRange([startRow, colStart], [endRow, colEnd]);
    }).forEach(function (r) {
      var marker;
      marker = editor.markBufferRange(r, {invalidate: "never"});
      editor.decorateMarker(marker, {type: "highlight", class: klass});
      editor.decorateMarker(marker, {type: "line-number", class: klass});
      if (following) {
        editor.scrollToBufferPosition(r.start, {
          center: !!data.summon
        });
        toActivate.push(editor.id);
      }
      markers_by_conn_id[user_id].push(marker);
    });
  });
  this.lastHighlightReceived = data;
  this.highlight_data_by_username[data.username] = data;

  let pane = atom.workspace.getActivePane();
  if (!pane || !toActivate || !following) {
    return;
  }

  let position = 0;
  _.each(pane.items, function (item) {
    if (_.contains(toActivate, item.id)) {
      pane.activateItemAtIndex(position);
    }
    position += 1;
  });
};

AtomListener.prototype.observeTextEditors = function (editor) {
  var fluffer, buffer, id, that = this;

  // bad stuff happens if we throw here
  try {
    that.bindTo_(editor, ["onDidChangeSelectionRange"]);

    fluffer = that.bufs.findFluffer(editor);

    if (!fluffer) {
      id = IMAGINARY_ID;
    } else {
      id = fluffer.id;
    }

    if (fluffer && !fluffer.populated && this.handledConflicts) {
      floop.send_get_buf(id);
    }

    if (!(id in that.atomEditors)) {
      that.atomEditors[id] = [];
    }

    that.atomEditors[id].push(editor);
    let d = editor.onDidDestroy(function () {
      let editors = that.atomEditors[id] || [];
      that.atomEditors = editors.filter(function (e) {
        return e.id !== editor.id;
      });
      that.disposables.remove(d);
    });

    that.disposables.add(d);

    buffer = editor.getBuffer();
    // editors to buffers is many to one
    // if (_.has(buffer, "floobitsID")) {
    //   return;
    // }

    buffer.floobitsID = id;
    // TODO: maybe check to see if one is there first?
    that.atomBuffers[id] = buffer;

    let dispose = buffer.onDidDestroy(function () {
      delete that.atomBuffers[buffer.floobitsID];
      that.disposables.remove(dispose);
    });

    that.disposables.add(dispose);

    that.bindTo_(buffer, ["onDidChangePath", "onDidSave", "onDidStopChanging", "onDidChange"]);
  } catch (e) {
    console.error(e);
  }
};

AtomListener.prototype.stop = function () {
  this.clear_highlights();

  _.each(this.atomEditors, function (editors) {
    _.each(editors, function (ae) {
      delete ae.floobitsID;
    });
  });

  _.each(this.atomBuffers, function (ab) {
    delete ab.floobitsID;
  });

  if (this.disposables) {
    this.disposables.dispose();
    this.disposables = null;
  }

  editorAction.off();
  bufferAction.off();

  this.movedFiles = {};
  this.atomBuffers = {};
  this.atomEditors = {};
  this.me = null;
  this.highlight_data_by_username = {};
};

AtomListener.prototype.setText = function (text, id, buffer) {
  const editors = this.atomEditors[id];
  const selections = [];
  _.each(editors, function (editor) {
    selections.push(editor.getSelectedBufferRanges());
  });
  this.ignore_events = true;
  buffer.setText(text);
  _.each(editors, function (editor, i) {
    const sel = selections[i];
    editor.setSelectedBufferRanges(sel);
  });
  this.ignore_events = false;
};

AtomListener.prototype.on_fluffer_changed = function (b, charPointer, patches) {
  var buffer = this.atomBuffers[b.id];

  if (!b.populated) {
    return;
  }

  const shouldSave = b.id in this.shouldSave;
  this.ignore_events = true;
  try {
    if (!buffer || !buffer.isAlive) {
      if (shouldSave) {
        /*eslint-disable no-sync */
        fs.writeFileSync(b.abs_path(), charPointer[0], {encoding: b.encoding});
        /*eslint-enable no-sync */
        delete this.shouldSave[b.id];
      }
    } else {
      if (!patches) {
        this.setText(charPointer[0], b.id, buffer);
      } else {
        console.log("updating", b.path);
        const checkpoint = buffer.createCheckpoint();
        _.each(patches[2], function (patch) {
          const offset = patch[0];
          const length = patch[1];
          const range = atomUtils.offsetToBufferRange(buffer, offset, offset + length);
          buffer.setTextInRange(range, patch[2]);
        });
        buffer.groupChangesSinceCheckpoint(checkpoint);
        charPointer[0] = buffer.getText();
      }
      if (shouldSave) {
        buffer.save();
        delete this.shouldSave[b.id];
      }
    }
  } catch (e) {
    console.error(e);
  }
  this.ignore_events = false;
};

AtomListener.prototype.clear_highlights = function() {
  const that = this;

  _.each(that.markers_by_conn_id, function (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
  });
  that.markers_by_conn_id = {};
};

AtomListener.prototype.start = function () {
  const that = this;

  this.disposables = new CompositeDisposable();

  editorAction.onCLEAR_HIGHLIGHTS(that.clear_highlights.bind(that));

  editorAction.onJUMP_TO_USER(function (username) {
    let data;
    if (username === "floobits") {
      data = this.lastHighlightReceived;
    } else {
      data = this.highlight_data_by_username[username];
    }
    if (!data) {
      return;
    }
    this.on_floobits_highlight(data);
  }, this);

  editorAction.onHANDLE_CONFLICTS(function (args) {
    if (_.isEmpty(args.newFiles) && _.isEmpty(args.different) && _.isEmpty(args.missing)) {
      that.handledConflicts = true;
      return;
    }
    args.onHandledConflicts = function (shouldSave) {
      that.shouldSave = shouldSave;
      that.handledConflicts = true;

      that.bufs.forEach(function (b, id) {
        if (id in shouldSave) {
          return;
        }
        // Set populated so we send patches for things we sent set_buf for
        b.set({populated: true}, {silent: true});
      });
    };
    const view = require("./build/conflicts")(args);
    const wrapper = require("./react_wrapper");
    const conflicts = wrapper.create_node("conflicts", view,
      {width: "100%", height: "100%", overflow: "auto"}
    );

    const P = require("../templates/pane");
    const p = new P("Floobits Conflicts", "", conflicts);
    const panes = atom.workspace.getPanes();
    _.each(panes, function (pane) {
      const items = pane.getItems();
      _.each(items, function (item) {
        if (item.title === "Floobits Conflicts") {
          pane.destroyItem(item);
        }
      });
    });
    atom.workspace.getActivePane().activateItem(p);
  }, this);

  this.disposables.add(atom.workspace.observeTextEditors(this.observeTextEditors.bind(this)));

  floop.onHIGHLIGHT(function (highlight) {
    that.on_floobits_highlight(highlight);
  });

  bufferAction.onDELETED(function (b, force) {
    const editors = that.atomEditors[b.id];

    _.each(editors, function (editor) {
      that.atomEditors[IMAGINARY_ID].push(editor);
    });

    delete that.atomEditors[b.id];
    delete that.atomBuffers[b.id];

    if (!force) {
      return;
    }
    that.ignore_events = true;
    try {
      /*eslint-disable no-sync */
      fs.unlinkSync(b.abs_path());
      /*eslint-enable no-sync */
    } catch (e) {
      console.error(e);
    }
    that.ignore_events = false;
  });

  bufferAction.onSAVED(function (b) {
    const buffer = that.atomBuffers[b.id];
    that.ignore_events = true;
    try {
      if (buffer && buffer.isAlive()) {
        buffer.save();
      } else {
        /*eslint-disable no-sync */
        fs.writeFileSync(b.abs_path(), b.buf, {encoding: b.encoding});
        /*eslint-enable no-sync */
      }
    } catch (e) {
      console.error(e);
    }
    that.ignore_events = false;
  });

  bufferAction.onCHANGED(function () {
    that.on_fluffer_changed.apply(that, arguments);
  });

  bufferAction.onRENAME(function (buf, oldPath, newPath) {
    const repo = atom.project.getRepo && atom.project.getRepo();
    const directoryPath = path.dirname(newPath);
    that.ignore_events = true;
    // From file-tree:rename more or less
    try {
      /*eslint-disable no-sync */
      if (!fs.existsSync(directoryPath)) {
        fs.makeTreeSync(directoryPath);
      }

      if (fs.existsSync(oldPath)) {
        fs.moveSync(oldPath, newPath);
      } else {
        fs.writeFileSync(newPath, buf.buf, {encoding: buf.encoding});
      }
      /*eslint-enable no-sync */
      that.movedFiles[newPath] = oldPath;
      if (repo) {
        repo.getPathStatus(oldPath);
        repo.getPathStatus(newPath);
      }
    } catch (error) {
      console.error(error);
    }
    that.ignore_events = false;
  });

  bufferAction.onADD(function (buf) {
    // const otherMe = username === that.username;
    let buffer = that.atomBuffers[buf.id];
    const p = buf.abs_path();
    // do we already know about the buffer?
    // this function is called from buf.add (room_info on reconnect)
    if (buffer) {
      if (!buffer.isAlive()) {
        delete that.atomBuffers[buf.id];
        delete buffer.floobitsID;
        buffer = undefined;
      } else if (buffer.getPath() !== p) {
        delete that.atomBuffers[buf.id];
        delete buffer.floobitsID;
        buffer = undefined;

        const editors = that.atomEditors[buf.id];
        const nextEditors = [];
        _.each(editors, function (editor) {
          if (editor.getPath() === p ) {
            nextEditors.push(editor);
            return;
          }
          delete editor.floobitsID;
          that.atomEditors[IMAGINARY_ID].push(editor);
        });
        that.atomEditors[buf.id] = nextEditors;
      }
    }

    if (buffer) {
      return;
    }

    // is the buffer open?
    const unlinkedEditors = that.atomEditors[IMAGINARY_ID] || [];
    const id = buf.id;
    _.each(unlinkedEditors, function (editor, index) {
      if (editor.getPath() !== p) {
        return undefined;
      }
      that.atomEditors[IMAGINARY_ID].splice(index, 1);

      if (!(id in that.atomEditors)) {
        that.atomEditors[id] = [];
      }
      that.atomEditors[id].push(editor);
      const editorBuffer = editor.getBuffer();
      if (_.has(editorBuffer, "floobitsID")) {
        delete that.atomBuffers[editorBuffer.floobitsID];
      }
      editorBuffer.floobitsID = id;
      if (!editorBuffer.isAlive()) {
        console.warn("found a zombie buffer?!", editorBuffer.getPath());
        return false;
      }
      that.atomBuffers[id] = editorBuffer;
      buffer = editorBuffer;
      return false;
    });
  });

  bufferAction.onCREATED(function (buf, username, connID) {
    const isMe = connID === (that.me ? that.me.getConnectionID() : false);
    let buffer = that.atomBuffers[buf.id];
    const p = buf.abs_path();
    // update the opened buffer
    if (buffer) {
      // assumes no binary files, because atom corrupts them anyway ...
      const txt = buffer.getText();
      // do we need to do anything?  could probably track SHAs on the buffer to avoid this.
      if (buf.buf === txt) {
        return;
      }
      // did we change the buffer in the mean time?
      if (isMe) {
        buf.send_patch([txt]);
        return;
      }
      // Someone else created the thing and its different than a local, opened copy.  Thats odd.
      that.setText(buf.buf, buf.id, buffer);
      return;
    }

    // Writing everything to disk again is slow and wasteful.  Maybe one day atom will propogate change events.
    if (isMe) {
      console.log(`skipping create_buf for myself (with no open buffer): ${buf.path}`);
      return;
    }

    // no open buffer, write to disk
    try {
      /*eslint-disable no-sync */
      fs.writeFileSync(p, buf.buf, {encoding: buf.encoding});
      /*eslint-enable no-sync */
    } catch (e) {
      // maybe permission error ... who knows what to do.
      console.error(e);
    }
    return;
  });
};

module.exports = AtomListener;
