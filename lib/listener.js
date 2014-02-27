var Listener = function () {}

Listener.prototype.listen = function() {
	atom.workspaceView.eachEditorView(function(e) {
		var editor = e.getEditor();
		editor.on("contents-modified", function(){
		  process.nextTick(function(){
		    // console.log('modified')
		  })
		})
	})
};
module.exports = Listener;