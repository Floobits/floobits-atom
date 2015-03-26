/** @jsx React.DOM */

"use strict";

const $ = require('atom-space-pen-views').$;
const React = require('react-atom-fork');

const JoinWorkspace = React.createClass({
  getInitialState: function () {
    return {
      path: ""
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
  tabs: ["url", "dir", "cancel", "submit"],
  onTab: function (event) {
    event.preventDefault();
    const position = parseInt(event.target.attributes["data-tab_order"].value, 10);
    const direction = event.shiftKey ? - 1 : 1;
    let next = position + direction;
    // no negative indexing in JS :(
    if (next < 0) {
      next = this.tabs.length - 1;
    } else if (next >= this.tabs.length) {
      next = 0;
    }

    const refName = this.tabs[next];
    const ref = this.refs[refName].getDOMNode();
    ref.focus();
  },
  componentDidUpdate: function () {
    $("#ultra-secret-hidden-file-input").attr("webkitdirectory", true);
  },
  componentDidMount: function () {
    $("#ultra-secret-hidden-file-input").attr("webkitdirectory", true);
    
    setTimeout(function () {
      $("#floobits-url").focus();
    }, 0);

    const that = this;
    $("#join-workspace").keydown(function(e) {
      switch (e.keyCode) {
        case 27:  // escape
          that.destroy();
          return;
        case 13:  // enter
          that.onSubmit();
          return;
        case 9:  // tab
          that.onTab(e);
          return;
        default:
          break;
      }
    });

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
  destroy: function () {
    $("#join-workspace").off("keydown");
    this.getDOMNode().parentNode.destroy(); 
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
                  <input data-tab_order="0" id="floobits-url" ref="url" className="native-key-bindings form-control" value={this.props.url} aria-describedby="url-addon" />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="input-group">
                  <span onClick={this.clickFileInput} className="input-group-addon" id="directory-addon" >Select Directory</span>
                  <input data-tab_order="1" onFocus={this.focusFileInput} onChange={this.onTyping} type="text" className="native-key-bindings form-control" placeholder="..." 
                    aria-describedby="directory-addon" value={this.state.path} ref="dir" />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-6">
                <input data-tab_order="3" ref="submit" onClick={this.onSubmit} type="submit" value="Join" className="floobits-submit" />
                <input data-tab_order="2" ref="cancel" onClick={this.destroy} type="submit" value="Cancel" className="floobits-submit" />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

module.exports = JoinWorkspace