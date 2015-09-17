"use strict";
const Socket = require("./common/floop");
const editorAction = require("./common/editor_action");

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

TerminalManager.prototype.start = function (terminals) {
  this.terminals = terminals;
  const that = this;

  editorAction.onOPEN_TERM(that.addTerminal.bind(that));
  editorAction.onCREATE_TERM(that.createTerm.bind(that));
};

TerminalManager.prototype.createTerm = function () {
  const termView = term2.newTerm(true, 80, 25);
  Socket.send_create_term({term_name: "adsf", size: [25, 80]});

  Socket.onCREATE_TERM(function (req) {
    if (req.term_name !== "adsf") {
      return;
    }
    const termID = req.id;

    termView.onData(function (d) {
      console.log('pty', d);
      Socket.send_term_stdout({'data': new Buffer(d).toString("base64"), id: termID});
    });

    termView.onResize(function (rows, cols) {
      Socket.send_update_term({id: termID, size: [rows, cols]});
    });

    Socket.onTERM_STDIN(function (data) {
      if (termID !== data.id) {
        return;
      }
      try {
        termView.input(new Buffer(data.data, "base64").toString("utf-8"));
      } catch (e) {
        console.warn(e);
      }
    }, this);
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
