"use strict";
const Socket = require("./common/floop");
const _ = require("lodash");
// const editorAction = require("./common/editor_action");
const CompositeDisposable = require('event-kit').CompositeDisposable;
const prefs = require("./common/userPref_model");

function TerminalManager () {
  // floobits term id to this.Term3 TermialView
  this.terms = {};

  this.term3_name_to_ids = {};

  this.term3 = null;
  this.username = null;
  this.floobits_terms = null;
}

TerminalManager.prototype.send_create_term = function (t) {
  if (!t.getForked()) {
    console.log("not sending create event for remotely driven terminal");
    return;
  }
  const d = t.getDimensions();
  const name = this.nameForTerm(t);
  this.term3_name_to_ids[name] = t.id;
  Socket.send_create_term({term_name: name, size: [d.cols, d.rows]});
};

TerminalManager.prototype.nameForTerm = function (term) {
  return `atom-${this.username}-${term.id}-${Math.floor(Math.random() * 10000)}`;
};

TerminalManager.prototype.on_floobits = function(username, floobits_terms) {
  this.username = username;
  this.floobits_terms = floobits_terms;

  if (!this.term3) {
    return;
  }
  this.start_();
};

TerminalManager.prototype.on_term3_service = function(term3) {
  this.term3 = term3;

  if (!this.floobits_terms || !this.username) {
    return;
  }
  this.start_();
};

TerminalManager.prototype.start_ = function () {
  const that = this;

  this.subs = new CompositeDisposable();

  const disposable = that.term3.onTerm(that.send_create_term.bind(that));

  this.subs.add(disposable);

  that.term3.getTerminals().forEach(that.send_create_term.bind(that));

  _.each(that.floobits_terms, function (t, termID) {
    const term = that.term3.newTerm(false, t.size[1], t.size[0], t.owner);
    that.terms[termID] = term;

    const subs = new CompositeDisposable();

    subs.add(term.onSTDIN(function (d) {
      Socket.send_term_stdin({'data': new Buffer(d).toString("base64"), id: termID});
    }));

    subs.add(term.onExit(function () {
      that.subs.remove(subs);
      subs.dispose();
      delete that.terms[termID];
    }));

    that.subs.add(subs);
  });

  Socket.onCREATE_TERM(function (req) {
    const name = req.term_name;
    const termID = req.id;

    const term3_ID = that.term3_name_to_ids[name];
    const term = _.find(that.term3.getTerminals(), function (t) {
      return t.id === term3_ID;
    });

    if (term) {
      that.terms[termID] = term;
    } else {
      that.terms[termID] = that.term3.newTerm(false);
      that.subs.add(that.terms[termID].onSTDIN(function (d) {
        Socket.send_term_stdin({'data': new Buffer(d).toString("base64"), id: termID});
      }));
      return;
    }

    const d = term.getDimensions();
    Socket.send_update_term({id: termID, size: [d.cols, d.rows]});

    const subs = new CompositeDisposable();

    subs.add(term.onSTDOUT(function (d) {
      Socket.send_term_stdout({data: new Buffer(d).toString("base64"), id: termID});
    }));

    subs.add(term.onResize(function (size) {
      Socket.send_update_term({id: termID, size: [size.cols, size.rows]});
    }));

    subs.add(term.onExit(function () {
      Socket.send_delete_term({id: termID});
      that.subs.remove(subs);
      subs.dispose();
      delete that.terms[termID];
    }));

    that.subs.add(subs);
  });

  Socket.onTERM_STDIN(function (data) {
    const term = that.terms[data.id];
    if (!term) {
      return;
    }

    if (prefs.isFollowing(data.username)) {
      term.focusPane();
    }

    let term_data = data.data;
    if (!term_data.length) {
      return;
    }

    term_data = new Buffer(term_data, "base64").toString("utf-8");

    // TODO: allow terminals to be unsafe
    if (true) {
      term_data = term_data.replace(/[\x04\x07\n\r]/g, "");
    }

    try {
      term.input(term_data);
    } catch (e) {
      console.warn(e);
    }
  });

  Socket.onDELETE_TERM(function (data) {
    const term = that.terms[data.id];

    if (!term) {
      return;
    }

    term.input("\r\n   *** TERMINAL CLOSED ***   \r\n");
  });

  Socket.onTERM_STDOUT(function (data) {
    const term = that.terms[data.id];

    if (!term) {
      return;
    }

    try {
      term.input(new Buffer(data.data, "base64").toString("utf-8"));
    } catch (e) {
      console.warn(e);
    }
  });

  Socket.onUPDATE_TERM(function (data) {
    const term = that.terms[data.id];

    if (!term) {
      return;
    }

    console.log("update term", data);
    if (data.size) {
      term.resize(data.size[0], data.size[1]);
    }
  });

  Socket.onSYNC(function (terms) {
    console.log("Attempting to sync...");
    _.each(terms, function (data, id) {
      const term = that.terms[id];

      if (!term) {
        return;
      }

      term.resize(data.cols, data.rows);
    });
  });
};

TerminalManager.prototype.stop = function(term3_disposed) {
  if (this.subs) {
    this.subs.dispose();
    this.subs = null;
  }
  // we may not get another term3...
  if (term3_disposed) {
    this.term3 = null;
  }
  this.floobits_terms = null;
  this.username = null;
};

module.exports = new TerminalManager();
