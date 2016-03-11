'use strict';

const FSM = require('../index');

// a._onEnter : a.test(22) : a._onExit : b._onEnter : b.test : b.test2 : b._onExit : a._onEnter : a.test(57)
let flag = true;
new FSM({
  initialState: 'a',
  states: {
    a: {
      _onEnter: function() {
        console.log('Entering A...');
        if (flag) {
          flag = false;
          // This is kinda strange?
          // handle.a will be executed before the transition does because the
          // transition into the initial state won't be complete until this _onEnter returns
          // That is unless we deferEvents until the next time we enter A
          this.deferEvents();
          this.handle('a', 'test', 22);
          this.transition('b');
        }
      },

      test: function(count) {
        console.log('(A) TEST: I can count this high: ', count);
      },

      _onExit: function() {
        console.log('Preparing to leave A...');
        this.handle('b', 'test', 'Peter');
      },
    },
    b: {
      _onEnter: function() {
        console.log('Entering B...');
      },

      test: function(name) {
        console.log('(B) TEST: My name is: ', name);
        this.handle('b', 'test2', name.toUpperCase());
      },

      test2: function(uName) {
        console.log('(B) TEST2: My serious name is: ', uName);
        // Conversely to the a._onEnter
        // This transition will begin executing immediately..
        // Which means the this.handle is racing with the transition which may or may not queue
        // But it should still be called properly...I think...
        this.transition('a');
        this.handle('a', 'test', 57);
      },

      _onExit: function() {
        console.log('Preparing to leave B...');
      },
    },
  },
});
