const FSM = require('../index');

// a._onEnter -> a._onExit -> b._onEnter -> b.test

new FSM({
  initialState: 'a',
  states: {
    a: {
      _onEnter: function() {
        console.log('Entering A...');
        this.transition('b');
      },

      _onExit: function() {
        console.log('Preparing to leave A...');
        this.handle('b', 'test', 'Peter');
      },
    },
    b: {
      _onEnter: function() {
        console.log('Entering B...');
        // console.dir(this.meta['b'].queue);
      },

      test: function(name) {
        console.log('My name is: ', name);
      },
    },
  },
});
