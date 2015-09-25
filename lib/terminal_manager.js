"use strict";
const Socket = require("./common/floop");
const _ = require("lodash");
// const editorAction = require("./common/editor_action");
const term2_package = atom.packages.loadPackage('term3');
// https://discuss.atom.io/t/cant-activate-package-in-specs/13672/9
term2_package.activateNow();
const term2 = term2_package.mainModule;
const CompositeDisposable = require('event-kit').CompositeDisposable;

function TerminalManager () {
  // floobits term id to Term2 TermialView
  this.terms = {};
}

TerminalManager.prototype.nameForTerm = function (term) {
  return `atom-${this.username}-${term.id}`;
};

TerminalManager.prototype.start = function (username, floobits_terms) {
  this.username = username;
  const that = this;

  _.each(floobits_terms, function (t, termID) {
    const term = term2.newTerm(false, t.size[1], t.size[0], t.owner);
    that.terms[termID] = term;

    const subs = new CompositeDisposable();

    subs.add(term.onSTDIN(function (d) {
      Socket.send_term_stdin({'data': new Buffer(d).toString("base64"), id: termID});
    }));

    subs.add(term.onExit(function () {
      subs.dispose();
      delete that.terms[termID];
    }));
  });

  term2.getTerminals().forEach(function (t) {
    const d = t.getDimensions();
    Socket.send_create_term({term_name: that.nameForTerm(t), size: [d.rows, d.cols]});
  });

  Socket.onCREATE_TERM(function (req) {
    const name = req.term_name;
    const termID = req.id;

    const term = _.find(term2.getTerminals(), function (t) {
      return name === that.nameForTerm(t);
    });

    if (!term) {
      that.terms[termID] = term2.newTerm(false);
      return;
    }
    const subs = new CompositeDisposable();
    subs.add(term.onSTDOUT(function (d) {
      Socket.send_term_stdout({'data': new Buffer(d).toString("base64"), id: termID});
    }));

    subs.add(term.onResize(function (rows, cols) {
      Socket.send_update_term({id: termID, size: [rows, cols]});
    }));

    subs.add(term.onExit( function () {
      Socket.send_delete_term({id: termID});
      subs.dispose();
      delete that.terms[termID];
    }));
  });

  Socket.onTERM_STDIN(function (data) {
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

module.exports = new TerminalManager();
