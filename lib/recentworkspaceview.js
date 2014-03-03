var util = require('util'),
  utils = require('./utils'),
  _ = require('lodash'),
  // atom = require("atom"),
  SelectListView = require("atom").SelectListView;

var RecentWorkspaceView = function(){
  SelectListView.apply(this, arguments);
};

utils.inherits(RecentWorkspaceView, SelectListView);

// RecentWorkspaceView.content = function() {
//   var self = this;
//   return self.div({"class": "floobits overlay from-top"}, function(){
//     return self.div(msg, {"class": "message"});
//   });
// };

RecentWorkspaceView.prototype.initialize = function() {
  var self = this;
  SelectListView.prototype.initialize.apply(self, arguments);
  
  self.addClass('overlay from-top');
  self.setItems(['Hello', 'World']);
  atom.workspaceView.append(this);
  self.focusFilterEditor();
};

RecentWorkspaceView.prototype.viewForItem = function(item) {
  return "<li>" + item + "</li>";
};

RecentWorkspaceView.prototype.confirmed = function(item) {
  console.log(util.format("%s was selected", item));
};

exports.RecentWorkspaceView = RecentWorkspaceView;
