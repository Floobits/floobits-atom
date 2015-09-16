/*global HTMLElement */

"use strict";

const TerminalView = Object.create(HTMLElement.prototype);

TerminalView.createdCallback = function () {
};

TerminalView.init = function (terminal) {
  this.terminal = terminal;
};

TerminalView.create_terminal = function () {
  var pty = require('pty');
  const Terminal = require("./common/extern/term");
  this.pty = pty.spawn(process.env.SHELL, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  const id = 32;

  this.terminal = new Terminal({
    cols: 80,
    rows: 30,
    title: "asdf",
    handler: function (data) {
      console.log('stdin', data);
      this.pty.write(data);
    }.bind(this)
  });

  const div = document.createElement("div");
  this.terminal.open(div);
  this.terminal.id = id;
  // this.terminal.title = title;
  this.terminal.deleted = false;
  this.terminal.div = div;


  this.pty.on('data', function(data) {
    console.log('pty', data);
    try {
      this.terminal.write(data);
    } catch (e) {
      console.warn(e);
    }
  }.bind(this));

  this.pty.on('exit', function () {
    // emit('term2:exit')
    // callback()
  });

  this.pty.write('ls\r');
  // this.pty.resize(100, 40);
  // this.pty.write('ls /\r');

  console.log(this.pty.process);

};


TerminalView.getIconName = function () {
  return "terminal";
};

TerminalView.attachedCallback = function () {
  console.log('attachedCallback');
  this.appendChild(this.terminal.div);
};

TerminalView.detachedCallback = function () {
  this.destroy();
};

TerminalView.destroy = function () {
  if (!this.pane) {
    return;
  }
  try {
    this.pane.destroy();
  } catch (e) {
    console.warn(e);
  }
  this.pane = null;
};

module.exports = document.registerElement("floobits-terminal_view", {prototype: TerminalView});
