var tls = require('tls');

module.exports = {
  floobitsView: null,

  activate: function(state) {
    atom.workspaceView.eachEditorView(function(e) {
      // var editor = e.getEditor();
      // editor.on("contents-modified", function(){
      //   process.nextTick(function(){
      //     // console.log('modified')
      //   })
      // })
    })
  },
  deactivate: function() {
  },
  serialize: function() {
  }
};
