"use strict";

const flux = require("flukes");
const utils = require("./utils");
const prefs = require("./userPref_model");
const _ = require("lodash");
const floop = require("./floop");
const bufferAction = require("./buffer_action");
const FlooDMP = require("../floodmp").FlooDMP;
const dmp = new FlooDMP();
const fields = flux.FieldTypes;

/**
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 */
function guid(id, owner, workspace) {
  return owner + "/" + workspace + "/" + id;
}


/**
 * @param {Object} data
 * @param {number} id
 * @param {string} owner
 * @param {string} workspace
 * @constructor
 */

const Buf = flux.createModel({
  modelName: "Buffer",
  fieldTypes: {
    buf: fields.string,
    highlights: fields.array,
    id: fields.number,
    md5: fields.number,
    open: fields.bool,
    path: fields.string,
    visible: fields.bool,
    encoding: fields.string,
    populated: fields.bool,
  },
  getDefaultFields: function () {
    return {
      buf: null,
      encoding: "utf8",
    };
  },
});


Buf.prototype.abs_path = function () {
  return utils.to_abs_path(this.path);
};

Buf.prototype.setGetBufTimeout = function () {
  var id = this.id;
  this.strike_timeout = setTimeout(function () {
    console.log("strikeout triggered because before md5s were different");
    floop.send_get_buf(id);
  }, 1100);
};

Buf.prototype.cleanUp = function () {
  clearTimeout(this.strike_timeout);
  clearTimeout(this.saveTimeout);
};

Buf.prototype.send_patch = function (newTextPointer) {
  var patches, patchInfo, newTxt;

  if (!this.populated) {
    return false;
  }

  newTxt = newTextPointer[0];

  patches = dmp.patch_make(this.buf, newTxt);

  if (patches.length === 0) {
    return false;
  }

  patchInfo = {
    md5_before: this.md5,
    md5_after: utils.md5(newTxt),
    id: this.id,
    patch: dmp.patch_toText(patches)
  };

  this.set({buf: newTxt, md5: patchInfo.md5_after}, {silent: true});
  prefs.pauseFollowMode(2000);
  floop.send_patch(patchInfo);
  return true;
};

Buf.prototype.patch = function (patch_obj) {
  let patches;
  try {
    patches = dmp.patch_fromText(patch_obj.patch);
  } catch (e) {
    throw new Error("Received Invalid bytes from workspace." + e.toString() + "Patch was: " + patch_obj.patch);
  }

  console.debug("applying", patch_obj.patch, "to", patch_obj.path);

  const md5_before = utils.md5(this.buf);
  if (patch_obj.md5_before !== md5_before) {
    console.log("starting md5s don't match! ours:", md5_before, "patch's:", patch_obj.md5_before);
  }
  if (_.isEmpty(patches)) {
    console.log("Got an empty set of patches.");
    return null;
  }
  let result;
  try {
    result = dmp.patch_apply(patches, this.buf);
  } catch (e) {
    console.error("Patch apply error on web.",
      {
        patch: patches,
        buf: this.buf,
        result: result,
        subject: "Patch Apply Failed ",
        error: e,
        message: { description: "Patch apply failed"},
      }
    );
    throw e; //Continue to throw since it's already broken anyway.
  }
  const text = result[0];
  let clean_patch = true;
  for (let i = 0; i < result[1].length; i++) {
    if (result[1][i] !== true) {
      clean_patch = false;
      break;
    }
  }
  if (clean_patch === false) {
    // XXX: don't reset this. ask the server to merge/rebase/whatever
    console.error("Couldn't apply patch. Getting buffer from server...", result);
    // messageAction.log("Couldn't apply patch to buffer " + this.path + " Re-fetching buffer from server...");
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return null;
  }

  const md5_after = utils.md5(text);

  if (patch_obj.md5_before === md5_before && patch_obj.md5_after !== md5_after) {
    // XXX: again, don't reset this. ask the server to merge/rebase/whatever
    console.log("md5's don't match! buffer is", md5_after, "but we expected", patch_obj.md5_after);
    this.populated = false;
    clearTimeout(this.strike_timeout);
    floop.send_get_buf(this.id);
    return null;
  }

  if (this.buf === text) {
    clearTimeout(this.strike_timeout);
    if (patch_obj.md5_after !== md5_after) {
      this.setGetBufTimeout();
    }
  } else if (patch_obj.md5_before !== md5_before) {
    clearTimeout(this.strike_timeout);
    this.setGetBufTimeout();
  } else {
    console.log("replacing didn't match :( should be", text, "but was", this.buf);
    try {
      console.log(dmp.patch_toText(dmp.patch_make(this.buf, text)));
    } catch (e) {
      console.log("Error making patch of text --> this.buf:", e);
    }
  }
  return {text: text, patches: result, md5: md5_after};
};

const Buffers = flux.createCollection({
  modelName: "Buffers",
  model: Buf,
  paths_to_ids: {},
  getBufferByPath: function (p) {
    var id = this.paths_to_ids[p];
    if (!id) {
      return null;
    }
    return this.get(id);
  },
  findFluffer: function (obj) {
    /* eslint-disable no-sync */
    const p = obj.getRealPathSync ? obj.getRealPathSync() : obj.getPath();
    /* eslint-enable no-sync */
    if (utils.is_shared(p)) {
      return this.getBufferByPath(utils.to_rel_path(p));
    }
  },
  init: function () {
    this.ids_ = [];
  },
  on_patch: function (data) {
    var buf = this.get(data.id);
    if (!buf) {
      return;
    }
    // this.setup_buf(buf);
    if (!buf.populated) {
      console.log("buf isn't populated. fetching");
      floop.send_get_buf(buf.id);
      return;
    }
    if (buf.encoding === "base64") {
      console.log("Floobits can't handle binary patches at the moment. Re-fetching.");
      floop.send_get_buf(buf.id);
      return;
    }
    if (!data.patch.length) {
      console.log("wtf? no patches!");
      return;
    }
    const patches = buf.patch(data);
    if (!patches) {
      return;
    }
    const charPointer = [patches.text];

    bufferAction.changed(buf, charPointer, patches.patches, data.username);
    buf.set({buf: charPointer[0], md5: patches.md5}, {silent: true});
  },
  on_room_info: function (workspace) {
    const that = this;

    const original = new Set(this.map(function (b) {
      return b.id;
    }));

    _.each(workspace.bufs, function (buf) {
      const b = that.get(buf.id);
      original.delete(buf.id);
      // the path may have changed, just easiest to delete it
      if (b) {
        delete that.paths_to_ids[b.path];
      }
      that.add(buf);
    });

    _.each(original, function (id) {
      const b = that.get(id);
      clearTimeout(b.strike_timeout);
      that.remove(b.id);
      bufferAction.deleted(b, false);
    });
  },
  on_saved: function (data) {
    var b = this.get(data.id);
    if (!b.populated) {
      return;
    }
    bufferAction.saved(b);
  },
  on_get_buf: function (data) {
    var b = this.get(data.id);
    data.populated = true;
    b.set(data, {silent: true});
    bufferAction.changed(b);
    clearTimeout(b.strike_timeout);
  },
  on_create_buf: function (d) {
    d.populated = true;
    this.add(d);
    bufferAction.created(this.get(d.id), d.username, d.user_id);
  },
  on_rename_buf: function (d) {
    var buf = this.get(d.id);
    var old_path = buf.abs_path();
    delete this.paths_to_ids[old_path];
    buf.path = d.path;
    this.paths_to_ids[buf.path] = buf.id;
    bufferAction.rename(buf, old_path, buf.abs_path());
  },
  on_delete_buf: function (d) {
    var b = this.get(d.id);
    if (!b) {
      console.warn("can't delete buffer, doesn't exist", d.path, d.id);
      return;
    }
    clearTimeout(b.strike_timeout);
    this.remove(b.id);
    delete this.paths_to_ids[d.path];
    bufferAction.deleted(b, d.unlink);
  },
  add: function (d) {
    this.super_.prototype.add.call(this, d);
    this.paths_to_ids[d.path] = d.id;
    bufferAction.add(this.get(d.id));
  },
  start: function () {
    this.ids_.push(floop.onPATCH(this.on_patch, this));
    this.ids_.push(floop.onGET_BUF(this.on_get_buf, this));
    this.ids_.push(floop.onSAVED(this.on_saved, this));
    this.ids_.push(floop.onDELETE_BUF(this.on_delete_buf, this));
    this.ids_.push(floop.onCREATE_BUF(this.on_create_buf, this));
    this.ids_.push(floop.onRENAME_BUF(this.on_rename_buf, this));
  },
  stop: function () {
    _.each(this.ids_, function (id) {
      floop.off(id);
    });
    this.forEach(function (b) {
      b.cleanUp();
    });
  }
});

module.exports = {
  Buffer: Buf,
  Buffers: Buffers,
  guid: guid,
};
