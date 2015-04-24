/** @jsx React.DOM */

"use strict";

const React = require('react-atom-fork');
const mixins = require("./mixins");
const wrapper = require("../react_wrapper");
const atomUtils = require("../atom_utils");

const YesNoCancel = React.createClass({
  mixins: [mixins.ReactUnwrapper, mixins.FormMixin],
  onSubmit: function (type, event) {
    type = type ? type.target.name : "yes";  // <-- from mixin
    const cb = this.props.cb.bind({}, null, type);
    setTimeout(cb, 0);
    this.destroy();
  },
  componentDidMount: function () {
    this.refs.yes.getDOMNode().focus();
  },
  render: function () {
    const yes = this.props.yes || "Yes";
    const no = this.props.no || "No";
    const cancel = this.props.cancel || "Cancel";
    return (
      <form>
        <h2 style={{textAlign: "center"}}>{this.props.title}</h2>
        <div className="well">
          <div className="row">
            <div className="col-md-12">
              <p>
                {this.props.body}
              </p>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <button tabIndex="4" className="btn btn-default" name="no" onClick={this.onSubmit.bind(this, "no")}>{no}</button>
            </div>
            <div className="col-md-6" style={{textAlign: "right"}}>
              <button tabIndex="5" className="btn btn-default" name="cancel" onClick={this.onSubmit.bind(this, "cancel")}>{cancel}</button>
              &nbsp;
              <button tabIndex="7" className="btn btn-primary" name="yes" onClick={this.onSubmit.bind(this, "yes")} ref="yes">{yes}</button>
            </div>
          </div>
        </div>
      </form>
    );
  }
});

module.exports = function (title, body, opts, cb) {
  if (!cb) {
    cb = opts;
    opts = {};
  }

  opts.title = title;
  opts.body = body;
  opts.cb = cb;

  const view = YesNoCancel(opts);
  atomUtils.addModalPanel('yes-no-cancel', view);
};