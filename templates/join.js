/** @jsx React.DOM */

"use strict";

var $ = require('atom-space-pen-views').$;

const React = require('react-atom-fork');

const JoinWorkspace = React.createClass({
  getInitialState: function () {
    return {
      path: ""
    };
  },
  onSubmit: function () {
    this.props.on_url(this.state.path, this.refs.url.getDOMNode().value);
  },
  onChange_: function (event) {
    const files = event.target.files;
    if (!files.length) {
      return;
    }
    const path = files[0].path;
    this.setState({path: path});
  },
  componentDidMount: function () {
    this.refs.dir.getDOMNode().setAttribute("webkitdirectory", true);
    
    setTimeout(function () {
      $("#floobits-url").focus();
    }, 0);

    var that = this;
    $("#join-workspace").keyup(function(e) {
      if (e.keyCode !== 27) { 
        return;
      }
      that.destroy();
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
  },
  destroy: function () {
    this.getDOMNode().parentNode.destroy(); 
  },
  onTyping: function (event) {
    const path = event.target.value;
    if (path === this.state.path) {
      return;
    }
    this.setState({path: path});
  },
  clickFileInput: function (event) {
    $("#ultra-secret-hidden-file-input").trigger('click');
  },
  render: function () {
    return (
      <div>
        <h2>Join Workspace</h2>
        <div className="well">
          <form id="join-workspace" onSubmit={this.onSubmit} className="native-key-bindings">
            <input id="ultra-secret-hidden-file-input" type="file" ref="dir" style={{display: "none"}} onChange={this.onChange_} />
            
            <div className="row">
              <div className="col-lg-12">
                <div className="input-group">
                  <span className="input-group-addon" id="url-addon">URL</span>
                  <input id="floobits-url" ref="url" className="native-key-bindings form-control" placeholder={this.props.url} aria-describedby="url-addon" />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <div className="input-group">
                  <span onClick={this.clickFileInput} className="input-group-addon" id="directory-addon" >Select Directory</span>
                  <input onClick={this.clickFileInput} onChange={this.onTyping} type="text" className="native-key-bindings form-control" placeholder="..." 
                    aria-describedby="directory-addon" value={this.state.path} />
                </div>
              </div>
            </div>

            <div className="row">
              <div className="col-lg-12">
                <input onClick={this.onSubmit} type="submit" value="Join" className="floobits-submit" />
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }
});

module.exports = JoinWorkspace