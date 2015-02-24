/** @jsx React.DOM */
"6to5"
var _ = require("lodash");
var React = require('react-atom-fork');

module.exports = React.createClass({
  render_: function (name, items) {
    return (
      <div>
        <h1>{name}</h1>
        <ol>
          {
            _.map(items, function(path, id) {
              return <li>{path}</li>;
            })
          } 
        </ol> 
      </div>
    )
  },
  render: function() {
    var missing = this.render_("missing", this.props.missing);
    var different = this.render_("different", this.props.different);
    var newFiles = this.render_("newFiles", this.props.newFiles);

    return (
      <div className="native-key-bindings" style={{overflow: "auto"}}>
        {missing}
        {different}
        {newFiles}
      </div> 
    );
  }
});