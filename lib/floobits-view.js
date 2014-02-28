var util = require('util');

var View = atom.view;

function FloobitsView(serializeState){
  View.call(this);
}

utils.inherits(FloobitsView, View);

FloobitsView.prototype.content = function(first_argument) {
  // @content: ->
  //   @div class: 'floobits overlay from-top', =>
  //     @div "The Floobits package is Alive! It's ALIVE!2", class: "message"
};

FloobitsView.prototype.initialize = function(serializeState) {
  atom.workspaceView.command("floobits:toggle", this.toggle.bind(this));
};

FloobitsView.prototype.serialize = function() {

};
FloobitsView.prototype.destroy = function() {
  this.detach();
};
FloobitsView.prototype.toggle = function() {
  console.log("FloobitsView was toggled!");
  if (this.hasParent()){
    this.detach();
  } else {
    atom.workspaceView.append(this);
  }
};

module.exports = FloobitsView;
