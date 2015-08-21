"use strict";

const chokidar = require("chokidar");

function Watcher () {
  this.chokidar = null;
  this.changed = {};
  this.added = {};
  this.unlinked = {};
}

Watcher.prototype.watch = function (path, is_ignored_func) {
  if (this.chokidar) {
    this.chokidar.close();
  }

  const options = {
    ignorePermissionErrors: true,
    ignored: is_ignored_func,
    cwd: path,  // Paths emitted with events will be relative to this
  };

  this.chokidar = chokidar.watch(path, options);

  this.chokidar
    .on('add', function(path) {
      console.log('File', path, 'has been added');
    }).on('change', function(path) {
      console.log('File', path, 'has been changed');
    }).on('unlink', function(path) {
      console.log('File', path, 'has been removed');
    }).on('addDir', function(path) {
      console.log('Directory', path, 'has been added');
    }).on('unlinkDir', function(path) {
      console.log('Directory', path, 'has been removed');
    }).on('error', function(error) {
      console.log('Error happened', error);
    }).on('ready', function() {
      console.log('Initial scan complete. Ready for changes.');
    }).on('raw', function(event, path, details) {
      console.log('Raw event info:', event, path, details);
    });
};

module.exports = new Watcher();
