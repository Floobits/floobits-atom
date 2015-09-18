"use strict";
const Socket = require("./common/floop");
const _ = require("lodash");
// const editorAction = require("./common/editor_action");

const term2_package = atom.packages.loadPackage('term2');
// https://discuss.atom.io/t/cant-activate-package-in-specs/13672/9
term2_package.activateNow();
// see https://github.com/f/atom-term.js/pull/5
// see https://github.com/f/atom-term.js/pull/4
const term2 = term2_package.mainModule;

function TerminalManager () {
  //
  this.terminals = null;
  this.openTerminals = {};
}

TerminalManager.prototype.nameForTerm = function (term) {
  return `atom-${this.username}-${term.id}`;
};

TerminalManager.prototype.start = function (username) {
  this.username = username;
  const that = this;

  Socket.onCREATE_TERM(function (req) {
    const name = req.term_name;
    const term = _.find(term2.getTerminals(), function (t) {
      return name === that.nameForTerm(t);
    });

    if (!term) {
      return;
    }

    const termID = req.id;

    term.onData(function (d) {
      console.log('pty', d);
      Socket.send_term_stdout({'data': new Buffer(d).toString("base64"), id: termID});
    });

    term.onResize(function (rows, cols) {
      Socket.send_update_term({id: termID, size: [rows, cols]});
    });

    Socket.onTERM_STDIN(function (data) {
      if (termID !== data.id) {
        return;
      }
      try {
        term.input(new Buffer(data.data, "base64").toString("utf-8"));
      } catch (e) {
        console.warn(e);
      }
    }, this);
  });

  term2.getTerminals().forEach(function (t) {
    const d = t.getDimensions();
    Socket.send_create_term({term_name: that.nameForTerm(t), size: [d.rows, d.cols]});
  });
};


// TerminalManager.prototype.addTerminal = function (terminal) {
//   const id = terminal.id;

//   if (id in this.openTerminals) {
//     const pane = this.openTerminals[id];
//     const view = pane.getView()[0];
//     pane.activePane.activateItem(pane);
//     view.focus();
//     return;
//   }
//   const view = new TerminalView();
//   view.init(terminal);
//   const pane = new Pane(`${terminal.username}-${terminal.title}`, "chevron-right", view, function () {
//     delete pane.activePane;
//     delete this.openTerminals[id];
//   }.bind(this));
//   const activePane = atom.workspace.getActivePane();
//   activePane.activateItem(pane);
//   pane.activePane = activePane;
//   this.openTerminals[id] = pane;
// };

TerminalManager.prototype.addTerminal = function (user, data) {
  const termID = data.id;
  const termView = term2.newTerm(false, data.size[1], data.size[0]);

  termView.onData(function (d) {
    console.log('pty', d);
  });

  const Socket = require("./common/floop");
  Socket.onTERM_STDOUT(function (data) {
    if (termID !== data.id) {
      return;
    }
    try {
      termView.input(new Buffer(data.data, "base64").toString("utf-8"));
    } catch (e) {
      console.warn(e);
    }
  }, this);

  const pane = atom.workspace.getActivePane();
  const item = pane.addItem(termView);
  pane.activateItem(item);
};

module.exports = new TerminalManager();
