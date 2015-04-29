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

function AtomListener (bufs, users) {
  this.bufs = bufs;
  this.users = users;
  this.editorID_ = 0;
  this.atomEditors = {};
  this.atomBuffers = {};
  this.disposables = null;
  this.send_patch_for = {};
  this.highlights = {};
  this.buffersSaved = {};
  this.movedFiles = {};
  this.highlightToSend = null;
  this.lastHighlightReceived = null;
  this.handledConflicts = false;
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

  console.log("sending patch");

  if (this.send_patch_for[bufferID]) {
    if (fluffer.populated) {
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

  if (this.ignore_events || !fluffer || !fluffer.populated) {
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

  buffer.floobitsID = fluffer ? fluffer.id : -1;

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
  var fluffer, editors, markers, highlights = this.highlights;

  if (!data || _.size(data.ranges) === 0) {
    return;
  }

  fluffer = this.bufs.get(data.id);

  if (!fluffer || !fluffer.populated) {
    return;
  }

  markers = highlights[data.username];
  if (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
    delete highlights[data.username];
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

  highlights[data.username] = [];

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
        editor.scrollToBufferPosition(r.start);
        toActivate.push(editor.id);
      }
      highlights[data.username].push(marker);
    });
  });
  this.lastHighlightReceived = data;

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
      id = -1;
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
  _.each(this.highlights, function (markers) {
    markers.forEach(function (m) {
      try {
        m.destroy();
      } catch (e) {
        console.log(e);
      }
    });
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
  this.highlights = {};
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

  this.ignore_events = true;

  try {
    if (!buffer || !buffer.isAlive()) {
      console.log("writing", b.path);
      fs.writeFileSync(b.abs_path(), charPointer[0], {encoding: b.encoding});
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
      if (b.shouldSave) {
        buffer.save();
        b.shouldSave = false;
      }
    }
  } catch (e) {
    console.error(e);
  }

  this.ignore_events = false;
};

AtomListener.prototype.start = function () {
  var that = this;

  this.disposables = new CompositeDisposable();

  // TODO: unbind these
  editorAction.onJUMP_TO_USER(function (username) {
    let data;
    if (username === "floobits") {
      data = this.lastHighlightReceived;
    } else {
      data = this.highlights[username];
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
    args.onHandledConflicts = function() {
      that.handledConflicts = true;
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
    // TODO: unbind
    delete that.atomBuffers[b.id];
    if (!force) {
      return;
    }
    that.ignore_events = true;
    try {
      fs.unlinkSync(b.abs_path());
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
        fs.writeFileSync(b.abs_path(), b.buf, {encoding: b.encoding});
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
    const repo = atom.project.getRepo();
    const directoryPath = path.dirname(newPath);
    that.ignore_events = true;
    // From file-tree:rename more or less
    try {
      if (!fs.existsSync(directoryPath)) {
        fs.makeTreeSync(directoryPath);
      }

      if (fs.existsSync(oldPath)) {
        fs.moveSync(oldPath, newPath);
      } else {
        fs.writeFileSync(newPath, buf.buf);
      }
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
  bufferAction.onCREATED(function (buf) {
    const buffer = that.atomBuffers[buf.id];
    if (!buffer) {
      fs.writeFileSync(buf.abs_path(), buf.buf, {encoding: buf.encoding});
      return;
    }
    that.setText(buf.buf, buf.id, buffer);
    const p = buf.abs_path();
    const unlinkedEditors = that.atomEditors[-1] || [];
    _.each(unlinkedEditors, function (editor, index) {
      if (editor.getPath() !== p) {
        return undefined;
      }
      that.atomEditors[-1].splice(index, 1);

      const id = buf.id;
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
      return false;
    });
  });
};

module.exports = AtomListener;
