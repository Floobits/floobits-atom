/** @jsx React.DOM */

"use strict";

const React = require('react-atom-fork');
const mixins = require("./mixins");
const atomUtils = require("../atom_utils");

const CodeReview = React.createClass({
  mixins: [mixins.ReactUnwrapper, mixins.FormMixin],
  onSubmit: function (state) {
    const cb = this.props.cb.bind({}, null, state, this.refs.description.getDOMNode().value);
    setTimeout(cb, 0);
    this.destroy();
  },
  componentDidMount: function () {
    this.refs.yes.getDOMNode().focus();
  },
  render: function () {
    return (
      <form>
        <h2 style={{textAlign: "center"}}>Experimental: Code Review</h2>
        <div className="well">
          <div className="row">
            <div className="col-md-12">
              Please describe your problem:
              <textarea ref="description" rows={3} style={{width: "100%", height: "100%", color: "black"}}>
              </textarea>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6"></div>
            <div className="col-md-6" style={{textAlign: "right"}}>
              <button tabIndex="5" className="btn btn-default" name="cancel" onClick={this.onSubmit.bind(this, false)}>cancel</button>
              &nbsp;
              <button tabIndex="7" className="btn btn-primary" name="yes" onClick={this.onSubmit.bind(this, true)} ref="yes">OK</button>
            </div>
          </div>
        </div>
      </form>
    );
  }
});

module.exports = function (cb) {
  const view = CodeReview({cb: cb});
  atomUtils.addModalPanel('code-review', view);
};