FlooIgnore.prototype.watch = function () {

  const options = {
    ignorePermissionErrors: true,
    ignored: is_ignored_func,
  };

  this.chokidar = chokidar.watch(fl.base_path, options);

  this.chokidar
    .on('add', function(path) { console.log('File', path, 'has been added'); })
    .on('change', function(path) { console.log('File', path, 'has been changed'); })
    .on('unlink', function(path) { console.log('File', path, 'has been removed'); })
    // More events.
    .on('addDir', function(path) { console.log('Directory', path, 'has been added'); })
    .on('unlinkDir', function(path) { console.log('Directory', path, 'has been removed'); })
    .on('error', function(error) { console.log('Error happened', error); })
    .on('ready', function() { console.log('Initial scan complete. Ready for changes.'); })
    .on('raw', function(event, path, details) { console.log('Raw event info:', event, path, details); });
};
