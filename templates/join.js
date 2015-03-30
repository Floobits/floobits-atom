/** @jsx React.DOM */

"use strict";

const $ = require('atom-space-pen-views').$;
const React = require('react-atom-fork');
const mixins = require("./mixins");

const JoinWorkspace = React.createClass({
  mixins: [mixins.ReactUnwrapper, mixins.FormMixin],
  getInitialState: function () {
    return {
      path: "",
      url: this.props.url,
    };
  },
  onSubmit: function () {
    setTimeout(function () {
      this.props.on_url(this.state.path, this.refs.url.getDOMNode().value);
    }.bind(this), 0);
    this.destroy();
  },
  onChange_: function (event) {
    const files = event.target.files;
    if (!files.length) {
      return;
    }
    const path = files[0].path;
    this.setState({path: path});
  },
  componentDidUpdate: function () {
    $("#ultra-secret-hidden-file-input").attr("webkitdirectory", true);
  },
  componentDidMount: function () {
    $("#ultra-secret-hidden-file-input").attr("webkitdirectory", true);
    
    setTimeout(function () {
      $("#floobits-url").focus();
    }, 0);

    const root = atom.project.rootDirectories;
    if (!root.length) {
      return;
    }
    const path = root[0].getPath();
    if (!path) {
      return;
    }
    this.setState({path: path});
    $("#ultra-secret-hidden-file-input").attr("webkitdirectory", true);
  },
  onTyping: function (event) {
    const path = event.target.value;
    if (path === this.state.path) {
      return;
    }
    this.setState({path: path});
  },
  focusFileInput: function (event) {
    $("#ultra-secret-hidden-file-input").trigger('click');
  },
  updateURL: function (e) {
    this.setState({url: e.target.value});
  },
  render: function () {
    return (
      <div>
        <h2>Join Workspace</h2>
        <div className="well">
          <form id="join-workspace" onSubmit={this.onSubmit} className="native-key-bindings">
            <input id="ultra-secret-hidden-file-input" type="file" ref="dir" style={{display: "none"}} onChange={this.onChange_} webkitdirectory />
            
            <div className="row">
              <div className="col-lg-12">
                <div className="input-group">
                  <span className="input-group-addon" id="url-addon">URL</span>
                  <input tabIndex="1" id="floobits-url" ref="url" className="native-key-bindings form-control" onChange={this.updateURL} value={this.state.url} aria-describedby="url-addon" />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="input-group">
                  <span onClick={this.clickFileInput} className="input-group-addon" id="directory-addon" >Select Directory</span>
                  <input tabIndex="3" onFocus={this.focusFileInput} onChange={this.onTyping} type="text" className="native-key-bindings form-control" placeholder="..." 
                    aria-describedby="directory-addon" value={this.state.path} ref="dir" />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-6">
                <input tabIndex="5" ref="submit" onClick={this.onSubmit} type="submit" value="Join" className="floobits-submit" />
                <input tabIndex="7" ref="cancel" onClick={this.destroy} type="submit" value="Cancel" className="floobits-submit" />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

module.exports = JoinWorkspace