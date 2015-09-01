"use strict";
const Pane = require("../templates/pane");
const TerminalView = require("./terminal_view");

function TerminalManager () {
  this.terminals = null;
  this.terminalViews = {};
}

TerminalManager.prototype.start = function(terminals) {
  this.terminals = terminals;
  const that = this;
  that.terminals.on(function () {
    that.terminals.forEach(function (t) {
      that.addTerminal(t);
    });
  });
};

TerminalManager.prototype.addTerminal = function(terminal) {
  if (terminal.id in this.terminalViews) {
    return;
  }
  // TODO: this will cause strangeness
  if (terminal.deleted) {
    return;
  }
  const view = new TerminalView();
  view.init(terminal);
  const pane = new Pane(`${terminal.username}-${terminal.title}`, "chevron-right", view);
  atom.workspace.getActivePane().activateItem(pane);
  this.terminals[terminal.id] = [terminal, view, pane];
};

module.exports = new TerminalManager();
