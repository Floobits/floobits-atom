var utils = require('./utils');
var React = require('react-atom-fork');
var div = require('reactionary-atom-fork').div;

Component = React.createClass({
  displayName: 'asdfasdfasdfasdf',
  render: function () {
    return div("asdf");
  }
});


function ASDF () {
  HTMLElement.call(this);
  this.shadow = null;
  this.styles = null;
}

utils.inherits(ASDF, HTMLElement);

ASDF.prototype.attach = function() {
  debugger;
};

ASDF.prototype.setModel = function(model) {
  this.model = model;
  this.model.on(function () {
    debugger
  }, this);
  debugger;
};

ASDF.prototype.destroy = function() {
  debugger;
};

ASDF.prototype.createdCallback = function(first_argument) {
  if (!this.shadow) {
    this.shadow = this.createShadowRoot();
  }
  this.styles = document.createElement('style');
  this.styles.textContent = ".floobits {color: red}";
  this.shadow.appendChild(this.styles.cloneNode(true));
  
  this.styles.setAttribute('context', 'floobits-asdf');

  this.root = document.createElement('div');
  this.root.classList.add('floobits');

  this.shadow.appendChild(this.root);

  this.component = React.renderComponent(Component(), this.root);
};

ASDF.prototype.attachedCallback = function() {

};

ASDF.prototype.attributeChangedCallback = function(attrName, oldVal, newVal) {

};

ASDF.prototype.detachedCallback = function () {
  debugger;
};


module.exports = ASDF = document.registerElement('floobits-asdf', {prototype: ASDF.prototype});